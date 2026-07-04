// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProofRandom
 * @dev Transparent random drawing system using Chainlink VRF v2.5.
 * No betting, no deposit/withdrawal. Used strictly for verifying random results.
 */
contract ProofRandom is VRFConsumerBaseV2Plus, Pausable, ReentrancyGuard {

    // Structure to store drawing session data
    struct DrawSession {
        uint256 requestId;      // Request ID from Chainlink VRF
        address creator;        // Wallet address of the creator
        uint8 drawType;         // 1: Number, 2: Name, 3: Multiple Winners, 4: Coin Flip, 5: Dice, 6: Even/Odd, 7: Color, 8: Letter, 9: Team
        uint256 param1;         // Parameter 1 (e.g. min, total participants, sides)
        uint256 param2;         // Parameter 2 (e.g. max, winners count, teams)
        uint256 randomWord;     // Random word returned by Chainlink VRF
        uint256 timestamp;      // Completion timestamp
        string eventName;       // Event name (e.g. "Giveaway Livestream #12")
        string result;          // Shortened result in string format
        bool fulfilled;         // Fulfilled status (callback received)
    }

    // --- CHAINLINK VRF CONFIGURATION ---
    uint256 public s_subscriptionId;
    bytes32 public s_keyHash;

    // Maximum gas allowed for fulfillRandomWords callback
    uint32 public s_callbackGasLimit = 400000;
    
    // Minimum block confirmations before returning the random word
    uint16 public s_requestConfirmations = 3;

    // --- DATA MANAGEMENT ---
    // List of all requestIds
    uint256[] public requestIds;

    // Mapping from requestId to session details
    mapping(uint256 => DrawSession) public sessions;

    // Anti-spam mapping: tracks block number of last request per user
    mapping(address => uint256) public lastUserRequestBlock;

    // --- EVENTS ---
    event DrawRequested(
        uint256 indexed requestId,
        address indexed creator,
        string eventName,
        uint8 indexed drawType,
        uint256 param1,
        uint256 param2
    );

    // Emitted with participants array for frontend verification without storing it on-chain
    event DrawCreated(
        uint256 indexed requestId,
        address indexed creator,
        string eventName,
        uint8 indexed drawType,
        string[] participants,
        uint256 param1,
        uint256 param2
    );

    event DrawFulfilled(
        uint256 indexed requestId,
        address indexed creator,
        uint256 randomWord,
        string result,
        uint256 timestamp
    );

    event VRFConfigUpdated(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations
    );

    error InvalidInput();
    error RequestAlreadyProcessed();
    error BlockLimitNotPassed();

    constructor(
        address vrfCoordinator,
        uint256 subscriptionId,
        bytes32 keyHash
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        s_subscriptionId = subscriptionId;
        s_keyHash = keyHash;
    }

    /**
     * @notice Update Chainlink VRF config (Owner only)
     */
    function updateVRFConfig(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations
    ) external onlyOwner {
        s_subscriptionId = subscriptionId;
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
        s_requestConfirmations = requestConfirmations;

        emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
    }

    /**
     * @notice Pause drawing requests (Owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause drawing requests (Owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Request a new random draw session
     * @param drawType Drawing mode (1-9)
     * @param param1 Parameter 1 (e.g. min, total participants, sides)
     * @param param2 Parameter 2 (e.g. max, winners count, teams count)
     * @param eventName Name of the drawing event
     * @param participants List of participant names (emitted in event)
     */
    function requestDraw(
        uint8 drawType,
        uint256 param1,
        uint256 param2,
        string calldata eventName,
        string[] calldata participants
    ) external whenNotPaused nonReentrant returns (uint256 requestId) {
        // Anti-spam: Max 1 request per block per account
        if (lastUserRequestBlock[msg.sender] >= block.number) revert BlockLimitNotPassed();
        
        // Input validation
        if (drawType < 1 || drawType > 9) revert InvalidInput();
        if (bytes(eventName).length == 0) revert InvalidInput();

        if (drawType == 1) { // Random Number
            if (param1 >= param2) revert InvalidInput(); // min must be less than max
        } else if (drawType == 2 || drawType == 3 || drawType == 9) { // Random Name, Multi Winners, Random Team
            if (participants.length == 0) revert InvalidInput();
            if (param1 != participants.length) revert InvalidInput(); // param1 must match participants length
            if (drawType == 3) {
                if (param2 == 0 || param2 > param1) revert InvalidInput(); // k winners must be <= total participants
            } else if (drawType == 9) {
                if (param2 == 0 || param2 > 50) revert InvalidInput(); // Max 50 teams to prevent gas limits
            }
        } else if (drawType == 5) { // Dice
            if (param1 != 6 && param1 != 20) revert InvalidInput(); // Only 6-sided or 20-sided dice allowed
        }

        // Request random numbers from Chainlink VRF
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: s_requestConfirmations,
                callbackGasLimit: s_callbackGasLimit,
                numWords: 1, // Request 1 random word
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        // Store initial session information
        sessions[requestId] = DrawSession({
            requestId: requestId,
            creator: msg.sender,
            drawType: drawType,
            param1: param1,
            param2: param2,
            randomWord: 0,
            timestamp: 0,
            eventName: eventName,
            result: "",
            fulfilled: false
        });

        requestIds.push(requestId);
        lastUserRequestBlock[msg.sender] = block.number;

        // Emit events
        emit DrawRequested(requestId, msg.sender, eventName, drawType, param1, param2);
        emit DrawCreated(requestId, msg.sender, eventName, drawType, participants, param1, param2);
    }

    /**
     * @notice Callback invoked by Chainlink VRF with random numbers
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        DrawSession storage session = sessions[requestId];
        
        // Ensure request exists and is not fulfilled yet
        if (session.creator == address(0)) return; // Ignore uninitialized request
        if (session.fulfilled) return;

        uint256 randomWord = randomWords[0];
        session.randomWord = randomWord;
        session.timestamp = block.timestamp;
        session.fulfilled = true;

        // Calculate the final result based on draw type
        session.result = calculateResult(
            session.drawType,
            session.param1,
            session.param2,
            randomWord
        );

        emit DrawFulfilled(requestId, session.creator, randomWord, session.result, block.timestamp);
    }

    /**
     * @notice Deterministic result calculation based on draw type and seed
     */
    function calculateResult(
        uint8 drawType,
        uint256 param1,
        uint256 param2,
        uint256 randomWord
    ) public pure returns (string memory) {
        if (drawType == 1) { // 1. Random Number
            uint256 min = param1;
            uint256 max = param2;
            uint256 selectedVal = min + (randomWord % (max - min + 1));
            return toString(selectedVal);
        }
        else if (drawType == 2) { // 2. Random Name
            uint256 total = param1;
            uint256 selectedIndex = randomWord % total;
            return toString(selectedIndex);
        }
        else if (drawType == 3) { // 3. Multiple Winners
            uint256 total = param1;
            uint256 k = param2;
            return getMultipleWinners(randomWord, total, k);
        }
        else if (drawType == 4) { // 4. Coin Flip
            return (randomWord % 2 == 0) ? "Heads" : "Tails";
        }
        else if (drawType == 5) { // 5. Dice
            uint256 sides = param1;
            uint256 selectedVal = 1 + (randomWord % sides);
            return toString(selectedVal);
        }
        else if (drawType == 6) { // 6. Even / Odd
            return (randomWord % 2 == 0) ? "Even" : "Odd";
        }
        else if (drawType == 7) { // 7. Random Color
            return getRandomColor(randomWord);
        }
        else if (drawType == 8) { // 8. Random Letter
            return getRandomLetter(randomWord);
        }
        else if (drawType == 9) { // 9. Random Team
            return "Teams Assigned";
        }

        return "";
    }

    /**
     * @notice Select K unique winners deterministically (gas-optimized)
     */
    function getMultipleWinners(
        uint256 randomWord,
        uint256 total,
        uint256 k
    ) internal pure returns (string memory) {
        if (k == 0 || total == 0) return "";
        if (k > total) k = total;

        uint256[] memory selected = new uint256[](k);
        uint256 tempRandom = randomWord;

        for (uint256 i = 0; i < k; i++) {
            tempRandom = uint256(keccak256(abi.encode(tempRandom, i)));
            uint256 candidate = tempRandom % total;

            bool duplicate = false;
            for (uint256 j = 0; j < i; j++) {
                if (selected[j] == candidate) {
                    duplicate = true;
                    break;
                }
            }

            if (duplicate) {
                uint256 attempt = 0;
                while (duplicate && attempt < 30) {
                    tempRandom = uint256(keccak256(abi.encode(tempRandom, attempt + 100)));
                    candidate = tempRandom % total;
                    duplicate = false;
                    for (uint256 j = 0; j < i; j++) {
                        if (selected[j] == candidate) {
                            duplicate = true;
                            break;
                        }
                    }
                    attempt++;
                }
            }
            selected[i] = candidate;
        }

        string memory resultStr = "";
        for (uint256 i = 0; i < k; i++) {
            if (i == 0) {
                resultStr = toString(selected[i]);
            } else {
                resultStr = string(abi.encodePacked(resultStr, ",", toString(selected[i])));
            }
        }
        return resultStr;
    }

    /**
     * @notice Generate a random HEX color code from seed
     */
    function getRandomColor(uint256 randomWord) internal pure returns (string memory) {
        bytes32 hash = keccak256(abi.encode(randomWord));
        bytes memory alphabet = "0123456789ABCDEF";
        bytes memory color = new bytes(7);
        color[0] = "#";
        for (uint256 i = 0; i < 3; i++) {
            uint8 val = uint8(hash[31 - i]);
            color[1 + i * 2] = alphabet[val >> 4];
            color[2 + i * 2] = alphabet[val & 0x0f];
        }
        return string(color);
    }

    /**
     * @notice Select a random letter (A-Z) from seed
     */
    function getRandomLetter(uint256 randomWord) internal pure returns (string memory) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        uint256 index = randomWord % 26;
        bytes memory letter = new bytes(1);
        letter[0] = alphabet[index];
        return string(letter);
    }

    /**
     * @notice Returns total number of sessions
     */
    function getSessionsCount() external view returns (uint256) {
        return requestIds.length;
    }

    /**
     * @notice Returns all requestIds
     */
    function getRequestIds() external view returns (uint256[] memory) {
        return requestIds;
    }

    /**
     * @notice Helper function to convert uint to string
     */
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
