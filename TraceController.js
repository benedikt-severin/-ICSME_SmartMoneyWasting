const axios = require('axios');

const archive_node_url = "### CHANGEME ###";

/*
 * Load a transaction by its hash using a raw JSON RPC call
 * Add further meta information from the transaction receipt
 */
exports.loadTx = async function (txHash) {
    try {
        // Step 1: load transaction
        console.log("eth_getTransactionByHash");
        const raw = JSON.stringify({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionByHash",
            "params": [
                "$txHash"
            ],
            "id": 1
        });
        let result = await doRequest(raw, txHash);
        if(result == undefined) {
            console.error('failed to load tx @ ',txHash);
            return undefined;
        }
        // Step 2: add meta information from transaction receipt
        let txReceipt = await getTxReceipt(txHash);

        // Step 3: construct return object
        result.gasLimit = parseInt(result.gas);
        delete result.gas;

        result.gasPrice = parseInt(result.gasPrice);
        result.blockNumber = parseInt(result.blockNumber);
        result.value = parseInt(result.value);

        if (txReceipt != undefined) {
            result.gasUsed = txReceipt.gasUsed;
            result.status = txReceipt.status;
        }

        return result;
    } catch (e) {
        console.log(e);
    }
}

/*
 * Load a execution trace by the transaction hash using a raw JSON RPC call
 */
exports.loadTrace = async function (txHash) {
    try {
        // Load execution trace without further storage information
        process.stdout.write("debug_traceTransaction");
        let raw = JSON.stringify({
            "jsonrpc": "2.0",
            "method": "debug_traceTransaction",
            "params": [
                "$txHash",
                {
                    "disableStorage": true,
                    "disableMemory": true,
                    "disableStack": true
                }
            ],
            "id": 1
        });

        return await doRequest(raw, txHash);
    } catch (e) {
        console.log(e);
    }
};

/*
 * Load a execution trace by the transaction hash using a raw JSON RPC call
 */
async function getTxReceipt(txHash) {
    try {
        // Step 1: load receipt
        const raw = JSON.stringify({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [
                "$txHash"
            ],
            "id": 1
        });
        let result = await doRequest(raw, txHash);
        if(result == undefined) {
            console.error('failed to load tx receipt @ ',txHash);
            return undefined;
        }

        // Step 2: construct return object
        result.gasUsed = parseInt(result.gasUsed);
        result.status = parseInt(result.status);

        return result;
    } catch (e) {
        console.log(e);
    }
}

/*
 * Generate the gas cost profile from an execution trace
 * As we only consider the first depth level, we need to re-calculate the gas usage of external calls
 */
exports.analyzeTrace = async function (tx, trace) {
    if(trace.structLogs[0] == undefined) {
        console.log('[analyzeTrace] undefined logs');
        return -1;
    }
    
    const gasLimit = tx.gasLimit;
    const baseFee = gasLimit - trace.structLogs[0].gas;

    const { gasList, actualGasUsed } = calculateCorrectGasCosts(trace, baseFee, gasLimit);
    const refundCounter = actualGasUsed - tx.gasUsed;
    const opcodeCostProfiles = createOpcodeProfile(gasList, baseFee, refundCounter);

    return mapToString(opcodeCostProfiles);
}

function calculateCorrectGasCosts(trace, baseFee, gasLimit) {
    let gasList = [];
    let gasCounter = 0;
    let innerCall = false;
    let refundCounter = 0;

    // we iterate over all executed opcodes
    trace.structLogs.forEach((e, index) => {
        const op = e.op;

        // Ziel ist es, dass die Gaskosten der call-Opcodes korrigiert werden
        // Daher können wir einen Stack verwenden, wobei das oberste Element immer die Gaskosten in der aktuellen Tiefe nachhält
        // 1 -> 2 -> 1 -> 3 -> 1
        // Stack 1 ; Stack 2 ; Stack 1 ; Stack 3 ; Stack 1


        // but only consider opcodes in the analyzed smart contract (depth=1)
        if (e.depth == 1) {
            // in case we return from external code execution
            // correct the gasCost of the "call" that initiated the external code
            if (innerCall) {
                const oldElement = gasList[gasList.length - 1];
                oldElement.correctedGasCost = oldElement.gas - e.gas;
                innerCall = false;
                gasCounter += oldElement.correctedGasCost + e.gasCost;
            } else {
                // the previous opcode had depth = 1
                if (op == 'CALL' || op == 'CALLCODE' || op == 'DELEGATECALL' || op == 'STATICCALL') {
                    // but now external code should be called
                    // so we recalculate the raw "call" opcode cost
                    if (trace.structLogs[index + 1].depth == 1) {
                        e.correctedGasCost = e.gas - trace.structLogs[index + 1].gas;
                        gasCounter += e.correctedGasCost;
                    }
                } else if (op == 'RETURN') {

                } else {
                    // no external call so just sum up the gasCost
                    gasCounter += e.gasCost;
                }
            }

            gasList.push(e);
        } else if (innerCall == false) {
            innerCall = true;
        }
    });

    process.stdout.write('BaseFee:'+ baseFee+ '// MyGasCounter:'+ gasCounter+ '// MyGasInklBaseFee:'+ (gasCounter + baseFee)+ '// RefundCounter:'+ refundCounter+ '//// GasUsedNoBaseFee:'+ (gasLimit - baseFee)+ '// GasLimit:'+ gasLimit+ '// CorrectCalculation?'+ (gasCounter + baseFee == gasLimit - trace.structLogs[trace.structLogs.length - 1].gas));
    const actualGasUsed = gasCounter + baseFee;
    return { gasList, actualGasUsed };
}

exports.getOpcodeCount = function(tx,trace) {
    const gasLimit = tx.gasLimit;
    if(trace.structLogs[0] == undefined) {
        console.log('[getOpcodeCount] undefined logs');
        return -1;
    }
    const baseFee = gasLimit - trace.structLogs[0].gas;

    const { gasList, actualGasUsed } = calculateCorrectGasCosts(trace, baseFee, gasLimit);
    const refundCounter = actualGasUsed - tx.gasUsed;

    const baseFeeEntry = 'BASE-FEE_'+baseFee;
    const refundEntry = 'REFUND_'+refundCounter;
    let opcodeMap = new Map();

    opcodeMap.set('1_'+baseFeeEntry,1);
    opcodeMap.set('1_'+refundEntry,1);

    gasList.forEach((e) => {
        const gasCost = e.correctedGasCost != undefined ? e.correctedGasCost : e.gasCost;
        const key = e.depth+'_'+e.op+'_'+gasCost
        let prevValue = opcodeMap.get(key);
        let newValue = (prevValue == undefined) ? 1 : prevValue+1;

        opcodeMap.set(key,newValue);
    });

    return mapToString(opcodeMap);
}


function createOpcodeProfile(gasList, baseFee, refundCounter) {
    let categoryCosts = new Map();
    let opcodeMap = generateOpcodeMap();
    let opcodeRevMap = generateReverseOpcodeMap(opcodeMap);

    gasList.forEach((e) => {
        let opCategory = opcodeRevMap.get(e.op);

        let prevValue = categoryCosts.get(opCategory)
        let newValue = (prevValue == undefined) ? 0 : prevValue;

        if (e.op == 'CALL' || e.op == 'CALLCODE' || e.op == 'DELEGATECALL' || e.op == 'STATICCALL') {
            newValue += e.correctedGasCost;
        } else {
            newValue += e.gasCost;
        }

        categoryCosts.set(opCategory, newValue);
    });
    if(isNaN(baseFee)) baseFee = -999;
    if(isNaN(refundCounter)) refundCounter = -999;

    categoryCosts.set('baseFee', baseFee);
    categoryCosts.set('refund', refundCounter);

    return categoryCosts;
}

function generateOpcodeMap() {
    // Arithmetic
    let arithmetic = ['ADD', 'MUL', 'SUB', 'DIV', 'SDIV', 'MOD', 'SMOD', 'ADDMOD', 'MULMOD', 'EXP', 'SIGNEXTEND', 'LT', 'GT', 'SLT', 'SGT', 'EQ', 'ISZERO', 'AND', 'OR', 'XOR', 'NOT', 'BYTE', 'SHR', 'SLR', 'SAR'];

    // Hashing
    let hashing = ['SHA3'];

    // Environmental
    let environment = ['ADDRESS', 'BALANCE', 'ORIGIN', 'CALLER', 'CALLVALUE', 'CALLDATALOAD', 'CALLDATASIZE', 'CALLDATACOPY', 'CODESIZE', 'CODECOPY', 'GASPRICE', 'EXTCODESIZE', 'EXTCODECOPY', 'RETURNDATASIZE', 'RETURNDATACOPY', 'EXTCODEHASH'];

    // Block Information
    let blockInfos = ['BLOCKHASH', 'COINBASE', 'TIMESTAMP', 'NUMBER', 'DIFFICULTY', 'GASLIMIT', 'CHAINID', 'SELFBALANCE', 'BASEFEE'];

    // Stack, Memory, Storage
    let storage = ['POP', 'MLOAD', 'MSTORE', 'MSTORE8', 'SLOAD', 'SSTORE'];
    //memory = ['MLOAD','MSTORE','MSTORE8']
    //storage = ['SLOAD','SSTORE'] 
    //stack = ['POP']
    //# Flow Information
    let flowInfos = ['JUMP', 'JUMPI', 'PC', 'MSIZE', 'GAS', 'JUMPDEST'];

    // Push operations
    let pushOperations = generateNumericalOpcode('PUSH', 1, 32);

    // Duplication operations
    let duplicateOperations = generateNumericalOpcode('DUP', 1, 16);

    // Swap operations
    let swapOperations = generateNumericalOpcode('SWAP', 1, 16);

    // Logging (LOG0 bis LOG4) > zahl = anzahl der topics
    let logging = generateNumericalOpcode('LOG', 0, 4);

    // System operations incl. STOP
    let systemOperations = ['CREATE', 'CALL', 'CALLCODE', 'RETURN', 'DELEGATECALL', 'CREATE2', 'STATICCALL', 'REVERT', '*REVERT', 'INVALID', 'SELFDESTRUCT', 'STOP'];

    let opcodeMap = new Map();
    opcodeMap.set('calculation', [...arithmetic, ...hashing, ...environment, ...blockInfos]);
    opcodeMap.set('communication', [...flowInfos]);
    opcodeMap.set('baseFee', ['BASE-FEE']);
    opcodeMap.set('external', [...systemOperations]);
    opcodeMap.set('storage, memory, stack', [...storage, ...pushOperations, ...duplicateOperations, ...swapOperations]);
    opcodeMap.set('logging', logging);

    return opcodeMap;
}

/* 
 * ### NETWORKING ###
 */

async function doRequest(raw, txHash) {
    const requestOptions = {
        method: 'POST',
        url: archive_node_url,
        headers: { 'Content-Type': 'application/json' },
        data: raw.replace('$txHash', txHash),
    };
    setTimeout(()=>{},1000);

    return await axios.request(requestOptions)
        .then(function (response) { process.stdout.write(" - ...gotResult"); return response.data.result; })
        .catch(error => console.error('error', error.response.status,error.response.statusText));
}


/* 
 * ### HELPER ###
 */

function generateNumericalOpcode(opcodeName, startNumber, endNumber) {
    let returnList = []
    for (let i = startNumber; i <= endNumber; i++) {
        returnList.push(opcodeName + i);
    }

    return returnList
}

function generateReverseOpcodeMap(opcodeMap) {
    let reverseOpcodeMap = new Map();
    opcodeMap.forEach((value, key, map) => {
        value.forEach(e => {
            reverseOpcodeMap.set(e, key);
        });
    }
    );
    return reverseOpcodeMap;
}

function mapToString (map) {
    let jsonObject = {};
    map.forEach((value, key) => {
        jsonObject[key] = value
    });
    return jsonObject;
}


