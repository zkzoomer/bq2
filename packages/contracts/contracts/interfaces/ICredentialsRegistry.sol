// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import "./ICredentialHandler.sol";
import { CredentialParameters, CredentialRating, CredentialState } from "../libs/Structs.sol";

/// @title Credentials Registry interface.
/// @dev Interface of a CredentialsRegistry contract.
interface ICredentialsRegistry is ICredentialHandler, ISemaphoreGroups {
    error CredentialTypeDoesNotExist();
    error CredentialDoesNotExist();
    error CredentialTypeAlreadyDefined();
    error InvalidCredentialManagerAddress();

    error InvalidTreeDepth();
    error InvalidRating();

    error MerkleTreeRootIsNotPartOfTheGroup();
    error MerkleTreeRootIsExpired();
    error UsingSameNullifierTwice();

    /// @dev Emitted when a credential is created.
    /// @param credentialId: Id of the credential.
    /// @param credentialType: Unique identifier that links to the credential manager that will define its behavior.
    event CredentialCreated(uint256 indexed credentialId, uint256 indexed credentialType);

    /// @dev Emitted when a rating is given to a credential and its issuer
    /// @param credentialId: Id of the credential
    /// @param admin: Address that controls the credential
    /// @param rating: Rating given to the credential issuer for this test
    /// @param comment: Comment given to the credential issuer for this test
    event NewCredentialRating(uint256 indexed credentialId, address indexed admin, uint256 rating, string comment);

    /// @dev Creates a new credential, defining the starting credential state, and calls the relevant credential manager define it.
    /// @param treeDepth: Depth of the trees that define the credential state
    /// @param credentialType: Unique identifier that links to the credential manager that will define its behavior.
    /// @param merkleTreeDuration: maximum time that an expired Merkle root can still be used to generate proofs of membership for this credential.
    /// @param credentialData: Data that defines the credential, as per the credential manager specifications.
    /// @param credentialURI: External resource containing more information about the credential
    function createCredential(
        uint256 treeDepth,
        uint256 credentialType,
        uint256 merkleTreeDuration,
        bytes calldata credentialData,
        string calldata credentialURI
    ) external;

    /// @dev Calls the relevant credential manager to update the credential.
    /// @param credentialId: Id of the credential.
    /// @param credentialUpdate: Data that defines the credential update, as per the credential manager specifications.
    function updateCredential(
        uint256 credentialId,
        bytes calldata credentialUpdate
    ) external;

    /// @dev Defines a new credential type by specifying the contract address of the credential manager that will define it.
    /// @param credentialType: Unique identifier of the new credential type.
    /// @param credentialManager: ICredentialManager compliant smart contract.
    function defineCredentialType(
        uint256 credentialType,
        address credentialManager
    ) external;

    /// @dev Proves ownership of a credential and gives a rating to a credential and its issuer
    /// @param credentialId: Id of the test for which the rating is being done.
    /// @param credentialsTreeRoot: Root of the credentials Merkle tree.
    /// @param nullifierHash: Nullifier hash.
    /// @param proof: Semaphore zero-knowledge proof.
    /// @param rating: Rating given to the credential issuer for this test, 0-100.
    /// @param comment: A comment given to the credential issuer.
    function rateCredential(
        uint256 credentialId,
        uint256 credentialsTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof,
        uint128 rating,
        string calldata comment
    ) external;

    /// @dev Verifies whether a Semaphore credential ownership/non-ownership proof is valid, and voids
    /// the nullifierHash in the process. This way, the same proof will not be valid twice.
    /// @param credentialId: Id of the credential for which the ownership proof is being done.
    /// @param merkleTreeRoot: Root of the credentials Merkle tree.
    /// @param nullifierHash: Nullifier hash.
    /// @param signal: Semaphore signal.
    /// @param externalNullifier: External nullifier.
    /// @param proof: Zero-knowledge proof.
    function verifyCredentialOwnershipProof(
        uint256 credentialId,
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256 signal,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external;

    /// @dev Verifies whether a grade claim proof is valid, and voids the nullifierHash in the process.
    /// This way, the same proof will not be valid twice.
    /// @param credentialId: Id of the credential for which the ownership proof is being done.
    /// @param gradeTreeRoot: Root of the grade Merkle tree.
    /// @param nullifierHash: Nullifier hash.
    /// @param gradeThreshold: Grade threshold the user claims to have obtained.
    /// @param signal: Semaphore signal.
    /// @param externalNullifier: external nullifier.
    /// @param proof: Zero-knowledge proof.
    function verifyGradeClaimProof(
        uint256 credentialId,
        uint256 gradeTreeRoot,
        uint256 nullifierHash,
        uint256 gradeThreshold,
        uint256 signal,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external;

    /// @dev Returns the type of the credential.
    /// @param credentialId: Id of the credential.
    /// @return uint256, credential type.
    function getCredentialType(
        uint256 credentialId
    ) external view returns (uint256);

    /// @dev Returns the manager of the credential.
    /// @param credentialId: Id of the credential.
    /// @return address, ITestManager compliant address that manages this credential.
    function getCredentialManager(
        uint256 credentialId
    ) external view returns (address);

    /// @dev Returns an external resource containing more information about the credential.
    /// @param credentialId: Id of the credential.
    /// @return string, the credential URI.
    function getCredentialURI(
        uint256 credentialId
    ) external view returns (string memory);

    /// @dev Returns the average rating that a credential has obtained.
    /// @param credentialId: Id of the credential.
    /// @return uint256, average rating the test received.
    function getCredentialAverageRating(
        uint256 credentialId
    ) external view returns(uint256);

    /// @dev Returns the timestamp when the given Merkle root was validated for a given credential.
    /// @param credentialId: Id of the credential.
    /// @param merkleRoot: Merkle root of interest.
    /// @return uint256, validation timestamp for the given `merkleRoot`.
    function getMerkleRootCreationDate(
        uint256 credentialId, 
        uint256 merkleRoot
    ) external view returns (uint256);

    /// @dev Returns whether a nullifier hash was already voided for a given credential.
    /// @param credentialId: Id of the credential.
    /// @param nullifierHash: Nullifier hash of interest.
    /// @return bool, whether the `nullifierHash` was already voided.
    function wasNullifierHashUsed(
        uint256 credentialId, 
        uint256 nullifierHash
    ) external view returns (bool);
}