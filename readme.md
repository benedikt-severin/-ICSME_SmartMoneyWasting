# Gas Cost Profiler

This repository contains a high-level Gas Cost Profiler for Ethereum smart contracts.
Our Node.js tool takes a transaction hash as input and generates a cost profile from the executed opcode trace.

## Requirements
Node.js must be installed.
Access to an Ethereum archive node is required in order to get execution traces. Free access can be requested from the [ArchiveNode](https://archivenode.io/) team. The archive node url must be inserted in the ```TraceController.js``` file as value for the variable ```archive_node_url```.

## Startup
For installation, open the folder location in a command line and run the ```npm install``` command.
Afterwards run ```npm start``` to start the local node.js web application.
Per default, the server starts on ```localhost:8002``` but you can customize these settings in the ```index.js``` file.

## Usage
Now you can use e.g. [Postman](https://www.postman.com/) or your browser to query the cost profile for a transaction.
To use the cost profiler in your browser, just open the URL ```localhost:8002/analyze/<txHash>```.
For testing purposes browse the [Etherscan](https://etherscan.io/txs) blockchain explorer, select a transaction and call the local profiler url with the transaction hash.

## Publication and Migration
This tool was presented and used in the following [ICSME'22 paper](https://doi.org/10.1109/ICSME55016.2022.00034).

> B. Severin, M. Hesenius, F. Blum, M. Hettmer and V. Gruhn, "Smart Money Wasting: Analyzing Gas Cost Drivers of Ethereum Smart Contracts," 2022 IEEE International Conference on Software Maintenance and Evolution (ICSME), 2022, pp. 293-304, doi: 10.1109/ICSME55016.2022.00034.

The final version of this repository was migrated to the GitHub account of our research group at the University of Duisburg-Essen:
>[https://github.com/UDE-SE/ICSME_SmartMoneyWasting/](https://github.com/UDE-SE/ICSME_SmartMoneyWasting/)
