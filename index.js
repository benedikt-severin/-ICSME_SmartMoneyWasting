const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');

const TraceAnalyzer = require('./TraceController')

// Variables
const port = 8002;

// create express application instance
const app = express()

// parse application/json
app.use(bodyParser.json())
app.use(cors());

// express route
app.get('/analyze/:txHash', async function (req, res) {
    console.log(req.params);
    console.log(req.body);

    let txHash = req.params.txHash;

    let tx = await TraceAnalyzer.loadTx(txHash);
    let trace = await TraceAnalyzer.loadTrace(txHash);
    let analysis = await TraceAnalyzer.analyzeTrace(tx,trace);

    
    let maxDepth = 0;
    trace.structLogs.forEach((item)=>{if(item.depth > maxDepth) maxDepth = item.depth;});
    console.log(maxDepth);

    res.send({
        'hash':tx.hash,
        'gasUsed':tx.gasUsed,
        'gasLimit':tx.gasLimit,
        'sender':tx.from,
        'receiver':tx.to,
        'baseFee':(analysis.baseFee != undefined ? analysis.baseFee : 0),
        'calculation':(analysis.calculation != undefined ? analysis.calculation : 0),
        'communication':(analysis.communication != undefined ? analysis.communication : 0),
        'external':(analysis.external != undefined ? analysis.external : 0),
        'logging':(analysis.logging != undefined ? analysis.logging : 0),
        //'refund':(analysis.refund != undefined ? analysis.refund : 0),
        'storage':(analysis['storage, memory, stack'] != undefined ? analysis['storage, memory, stack'] : 0),
        'maxDepth': maxDepth
    });   
});

// start server
const server = app.listen(port, e => {
    console.log('server is running!', port);
});