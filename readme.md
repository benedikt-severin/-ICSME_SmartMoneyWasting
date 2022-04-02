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


