export const PROOF_RANDOM_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "vrfCoordinator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "subscriptionId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "keyHash",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BlockLimitNotPassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInput",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RequestAlreadyProcessed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "eventName",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "uint8",
        "name": "drawType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "participants",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "param1",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "param2",
        "type": "uint256"
      }
    ],
    "name": "DrawCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "randomWord",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "result",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "DrawFulfilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "eventName",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "uint8",
        "name": "drawType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "param1",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "param2",
        "type": "uint256"
      }
    ],
    "name": "DrawRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "subscriptionId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "keyHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "callbackGasLimit",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "uint16",
        "name": "requestConfirmations",
        "type": "uint16"
      }
    ],
    "name": "VRFConfigUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "drawType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "param1",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "param2",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "randomWord",
        "type": "uint256"
      }
    ],
    "name": "calculateResult",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRequestIds",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSessionsCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "drawType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "param1",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "param2",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "eventName",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "participants",
        "type": "string[]"
      }
    ],
    "name": "requestDraw",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "sessions",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "drawType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "param1",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "param2",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "randomWord",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "eventName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "result",
        "type": "string"
      },
      {
        "internalType": "bool",
        "name": "fulfilled",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "subscriptionId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "keyHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint32",
        "name": "callbackGasLimit",
        "type": "uint32"
      },
      {
        "internalType": "uint16",
        "name": "requestConfirmations",
        "type": "uint16"
      }
    ],
    "name": "updateVRFConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
