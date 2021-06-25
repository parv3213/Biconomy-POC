//SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

// import "./EIP712MetaTransaction.sol";
import "./BasicMetaTransaction.sol";

contract TestContract is BasicMetaTransaction {

    string public quote;
    address public owner;

    function setQuote(string memory newQuote) public {
        quote = newQuote;
        owner = msgSender();
    }

    function getQuote() view public returns(string memory currentQuote, address currentOwner) {
        currentQuote = quote;
        currentOwner = owner;
    }
}