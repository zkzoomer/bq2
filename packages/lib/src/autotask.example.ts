const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');
const { ethers } = require('ethers');

exports.handler = async function(event) {
    const { body } = event.request;
  
	console.info(body)

	if (!body || !body.abi || !body.functionName || !body.functionParameters) {
    	throw Error("The request body was not formatted correctly")
    }
  
  	const { abi, functionName,  functionParameters } = body
    const address = "0xF12B8dAeDe57273C40b8dcD75Fa1796C21Aa2C44"

    const provider = new DefenderRelayProvider(event);
    const signer = new DefenderRelaySigner(event, provider, { speed: 'fast' });

    const contract = new ethers.Contract(address, abi, signer);

    const tx = await contract[functionName](...functionParameters);

    return tx.wait();
}
