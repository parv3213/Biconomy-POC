import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@material-ui/core/Button";
import {
  NotificationContainer,
  NotificationManager
} from "react-notifications";
import "react-notifications/lib/notifications.css";

import { Biconomy } from "@biconomy/mexa";
import {toBuffer} from "ethereumjs-util";
import abi from "ethereumjs-abi";
import events from "events";

import Web3 from "web3";
let sigUtil = require("eth-sig-util");
const { config } = require("./config");


const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
];

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

let domainData = {
  name: "TestContract-Parv",
  version: "1",
  verifyingContract: config.contract.address
};

let web3;
let contract;

function App() {
  const [quote, setQuote] = useState("This is a default quote");
  const [owner, setOwner] = useState("Default Owner Address");
  const [newQuote, setNewQuote] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [metaTxEnabled, setMetaTxEnabled] = useState(true);
  useEffect(() => {
    async function init() {
      if (
        typeof window.ethereum !== "undefined" &&
        window.ethereum.isMetaMask
      ) {
        // Ethereum user detected. You can now use the provider.
        const provider = window["ethereum"];
        await provider.enable();
        const biconomy = new Biconomy(provider,{apiKey: "EQ3xBhNSC.e0250f96-ac72-409f-b24f-ff8e08a25be7"});
        if (provider.networkVersion === "4") {
          domainData.chainId = 4;
          web3 = new Web3(biconomy);
          biconomy.onEvent(biconomy.READY, () => {
            // Initialize your dapp here like getting user accounts etc
            // await window.ethereum.enable();
            contract = new web3.eth.Contract(
              config.contract.abi,
              config.contract.address
            );
            setSelectedAddress(provider.selectedAddress);
            getQuoteFromNetwork();
          }).onEvent(biconomy.ERROR, (error, message) => {
            // Handle error while initializing mexa
            console.log(error)
          });
          
          provider.on("accountsChanged", function(accounts) {
            setSelectedAddress(accounts[0]);
          });
        } else {
          showErrorMessage("Please change the network in metamask to Ropsten");
        }
      } else {
        showErrorMessage("Metamask not installed");
      }
    }
    init();
  }, []);

  const executeMetaTransaciton = async (userAddress, functionSignature, contract, contractAddress, chainId) => {
    var eventEmitter = new events.EventEmitter();
    if(contract && userAddress && functionSignature, chainId, contractAddress) {
      let nonce = await contract.methods.getNonce(userAddress).call();
      let messageToSign = constructMetaTransactionMessage(nonce, chainId, functionSignature, contractAddress);

      const signature = await web3.eth.personal.sign(
        "0x" + messageToSign.toString("hex"),
        userAddress
      );

      console.info(`User signature is ${signature}`);
      let { r, s, v } = getSignatureParameters(signature);

      console.log("before transaction listener");
      // No need to calculate gas limit or gas price here
      let transactionListener = contract.methods.executeMetaTransaction(userAddress, functionSignature, r, s, v).send({
          from: userAddress
      });

      transactionListener.on("transactionHash", (hash)=>{
        eventEmitter.emit("transactionHash", hash);
      }).once("confirmation", (confirmation, recipet) => {
        eventEmitter.emit("confirmation", confirmation, recipet);
      }).on("error", error => {
        eventEmitter.emit("error", error);
      });

      return eventEmitter;
    } else {
      console.log("All params userAddress, functionSignature, chainId, contract address and contract object are mandatory");
    }
  }

  const constructMetaTransactionMessage = (nonce, chainId, functionSignature, contractAddress) => {
    return abi.soliditySHA3(
        ["uint256","address","uint256","bytes"],
        [nonce, contractAddress, chainId, toBuffer(functionSignature)]
    );
  }

  const getSignatureParameters = signature => {
    if (!web3.utils.isHexStrict(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    var r = signature.slice(0, 66);
    var s = "0x".concat(signature.slice(66, 130));
    var v = "0x".concat(signature.slice(130, 132));
    v = web3.utils.hexToNumber(v);
    if (![27, 28].includes(v)) v += 27;
    return {
      r: r,
      s: s,
      v: v
    };
  };


  const onQuoteChange = event => {
    setNewQuote(event.target.value);
  };

  const onSubmit = async event => {
    if (newQuote != "" && contract) {
      if (metaTxEnabled) {
        console.log("Sending meta transaction");
        let userAddress = selectedAddress;
        let nonce = await contract.methods.getNonce(userAddress).call();
        let functionSignature = contract.methods.setQuote(newQuote).encodeABI();
        let message = {};
        message.nonce = parseInt(nonce);
        message.from = userAddress;
        message.functionSignature = functionSignature;
        let result = await executeMetaTransaciton(userAddress, functionSignature, contract, config.contract.address, "4");
        result.on("transactionHash", (hash)=>{
          // On transacion Hash
        }).once("confirmation", (confirmation, recipet) => {
          // On Confirmation
        }).on("error", error => {
          // On Error  
        })
        // const dataToSign = JSON.stringify({
        //   types: {
        //     EIP712Domain: domainType,
        //     MetaTransaction: metaTransactionType
        //   },
        //   domain: domainData,
        //   primaryType: "MetaTransaction",
        //   message: message
        // });
        // console.log(domainData);
        // console.log();
        // web3.currentProvider.send(
        //   {
        //     jsonrpc: "2.0",
        //     id: 999999999999,
        //     method: "eth_signTypedData_v4",
        //     params: [userAddress, dataToSign]
        //   },
        //   function(error, response) {
        //     console.info(`User signature is ${response.result}`);
        //     if (error || (response && response.error)) {
        //       showErrorMessage("Could not get user signature");
        //     } else if (response && response.result) {
        //       let { r, s, v } = getSignatureParameters(response.result);
        //       console.log(userAddress);
        //       console.log(JSON.stringify(message));
        //       console.log(message);
        //       console.log(getSignatureParameters(response.result));

        //       const recovered = sigUtil.recoverTypedSignature_v4({
        //         data: JSON.parse(dataToSign),
        //         sig: response.result
        //       });
        //       console.log(`Recovered ${recovered}`);
        //       sendTransaction(userAddress, functionSignature, r, s, v);
        //     }
        //   }
        // );
      } else {
        console.log("Sending normal transaction");
        contract.methods
          .setQuote(newQuote)
          .send({ from: selectedAddress })
          .on("transactionHash", function(hash) {
            showInfoMessage(`Transaction sent to blockchain with hash ${hash}`);
          })
          .once("confirmation", function(confirmationNumber, receipt) {
            showSuccessMessage("Transaction confirmed");
            getQuoteFromNetwork();
          });
      }
    } else {
      showErrorMessage("Please enter the quote");
    }
  };

  // const getSignatureParameters = signature => {
  //   if (!web3.utils.isHexStrict(signature)) {
  //     throw new Error(
  //       'Given value "'.concat(signature, '" is not a valid hex string.')
  //     );
  //   }
  //   var r = signature.slice(0, 66);
  //   var s = "0x".concat(signature.slice(66, 130));
  //   var v = "0x".concat(signature.slice(130, 132));
  //   v = web3.utils.hexToNumber(v);
  //   if (![27, 28].includes(v)) v += 27;
  //   return {
  //     r: r,
  //     s: s,
  //     v: v
  //   };
  // };

  const getQuoteFromNetwork = () => {
    if (web3 && contract) {
      contract.methods
        .getQuote()
        .call()
        .then(function(result) {
          console.log(result);
          if (
            result &&
            result.currentQuote != undefined &&
            result.currentOwner != undefined
          ) {
            if (result.currentQuote == "") {
              showErrorMessage("No quotes set on blockchain yet");
            } else {
              setQuote(result.currentQuote);
              setOwner(result.currentOwner);
            }
          } else {
            showErrorMessage("Not able to get quote information from Network");
          }
        });
    }
  };

  const showErrorMessage = message => {
    NotificationManager.error(message, "Error", 5000);
  };

  const showSuccessMessage = message => {
    NotificationManager.success(message, "Message", 3000);
  };

  const showInfoMessage = message => {
    NotificationManager.info(message, "Info", 3000);
  };

  const sendTransaction = async (userAddress, functionData, r, s, v) => {
    if (web3 && contract) {
      try {
        // let gasLimit = await contract.methods
        //   .executeMetaTransaction(userAddress, functionData, r, s, v)
        //   .estimateGas({ from: userAddress });
        let gasPrice = await web3.eth.getGasPrice();
        // console.log(gasLimit);
        console.log(gasPrice);
        let tx = contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .send({
            from: userAddress,
            gasPrice: web3.utils.toHex(gasPrice),
            // gasLimit: web3.utils.toHex(gasLimit)
          });

        tx.on("transactionHash", function(hash) {
          console.log(`Transaction hash is ${hash}`);
          showInfoMessage(`Transaction sent by relayer with hash ${hash}`);
        }).once("confirmation", function(confirmationNumber, receipt) {
          console.log(receipt);
          showSuccessMessage("Transaction confirmed on chain");
          getQuoteFromNetwork();
        });
      } catch (error) {
        console.log(error);
      }
    }
  };

  return (
    <div className="App">
      <section className="main">
        <div className="mb-wrap mb-style-2">
          <blockquote cite="http://www.gutenberg.org/ebboks/11">
            <p>{quote}</p>
          </blockquote>
        </div>

        <div className="mb-attribution">
          <p className="mb-author">{owner}</p>
          {selectedAddress.toLowerCase() === owner.toLowerCase() && (
            <cite className="owner">You are the owner of the quote</cite>
          )}
          {selectedAddress.toLowerCase() !== owner.toLowerCase() && (
            <cite>You are not the owner of the quote</cite>
          )}
        </div>
      </section>
      <section>
        <div className="submit-container">
          <div className="submit-row">
            <input
              type="text"
              placeholder="Enter your quote"
              onChange={onQuoteChange}
              value={newQuote}
            />
            <Button variant="contained" color="primary" onClick={onSubmit}>
              Submit
            </Button>
          </div>
        </div>
      </section>
      <NotificationContainer />
    </div>
  );
}

export default App;
