const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');
const { ethers } = require('ethers');

exports.handler = async function(event) {
    const { body } = event.request;
  
	console.info(body)

	if (!body || !body.abi || !body.functionName || !body.functionParameters) {
    	throw Error("The request body was not formatted correctly")
    }
  
  	const { abi, functionName,  functionParameters } = body
    const credentialsRegistryAddress = "0x5A140303E92da80BF96a734fd777957fF02714C4"

    const provider = new DefenderRelayProvider(event);
    const signer = new DefenderRelaySigner(event, provider, { speed: 'fast' });

    const contract = new ethers.Contract(credentialsRegistryAddress, abi, signer);

    const tx = await contract[functionName](...functionParameters);

    return tx.wait();
}
