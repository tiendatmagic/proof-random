// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VRFCoordinatorV2_5Mock {
    uint256 private s_nextRequestId = 1;

    struct RequestInfo {
        address consumer;
        uint32 numWords;
    }

    mapping(uint256 => RequestInfo) public s_requests;

    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 preSeed,
        uint256 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs,
        address indexed sender
    );

    event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint96 payment, bool success);

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId) {
        requestId = s_nextRequestId++;
        s_requests[requestId] = RequestInfo({
            consumer: msg.sender,
            numWords: req.numWords
        });

        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            0, // preSeed
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            req.extraArgs,
            msg.sender
        );
    }

    function fulfillRandomWords(uint256 requestId, address consumer) external {
        RequestInfo memory req = s_requests[requestId];
        require(req.consumer != address(0), "Request not found");
        
        uint256[] memory randomWords = new uint256[](req.numWords);
        for (uint32 i = 0; i < req.numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encode(requestId, i)));
        }

        // Gọi callback rawFulfillRandomWords trên consumer contract
        (bool success, ) = req.consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );

        emit RandomWordsFulfilled(requestId, 0, 0, success);
    }
}
