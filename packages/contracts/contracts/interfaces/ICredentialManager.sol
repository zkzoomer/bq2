// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "./ICredentialHandler.sol";
import { CredentialState } from "../libs/Structs.sol";

/// @title Credential Manager interface.
/// @dev Interface of a CredentialManager contract.
interface ICredentialManager is ICredentialHandler, IERC165 {
    error CallerIsNotTheCredentialsRegistry();
    error CallerIsNotTheCredentialAdmin();
    error CredentialWasInvalidated();
    error MerkleTreeDepthIsNotSupported();

    /// @dev Emitted when a credential is invalidated by its admin.
    /// @param credentialId: Id of the credential.
    event CredentialInvalidated(uint256 indexed credentialId);

    /// @dev Emitted when a user's grade commitment is added to the grade tree.
    /// @param credentialId: Id of the credential.
    /// @param index: Commitment index.
    /// @param gradeCommitment: New identity commitment added to the credentials tree.
    /// @param gradeTreeRoot: New root hash of the grade tree.
    event GradeMemberAdded(uint256 indexed credentialId, uint256 index, uint256 gradeCommitment, uint256 gradeTreeRoot);

    /// @dev Emitted when a credential is gained and the user's identity commitment is added to the credential tree.
    /// @param credentialId: Id of the credential.
    /// @param index: Commitment index.
    /// @param identityCommitment: New identity commitment added to the credentials tree.
    /// @param credentialsTreeRoot: New root hash of the credentials tree.
    event CredentialsMemberAdded(uint256 indexed credentialId, uint256 index, uint256 identityCommitment, uint256 credentialsTreeRoot);

    /// @dev Emitted when a a credential is not gained and the user's identity commitment is added to the no-credential tree.
    /// @param credentialId: Id of the credential.
    /// @param index: Commitment index.
    /// @param identityCommitment: New identity commitment added to the credentials tree.
    /// @param noCredentialsTreeRoot: New root hash of the credentials tree.
    event NoCredentialsMemberAdded(uint256 indexed credentialId, uint256 index, uint256 identityCommitment, uint256 noCredentialsTreeRoot);

    /// @dev Emitted when a grade group member is updated.
    /// @param credentialId: Id of the credential.
    /// @param gradeTreeIndex: Grade commitment index within the grade tree.
    /// @param gradeCommitment: Existing grade commitment in the grade tree to be updated.
    /// @param newGradeCommitment: New grade commitment.
    /// @param gradeTreeRoot: New root hash of the grade tree.
    event GradeMemberUpdated(
        uint256 indexed credentialId,
        uint256 gradeTreeIndex,
        uint256 gradeCommitment,
        uint256 newGradeCommitment,
        uint256 gradeTreeRoot
    );

    /// @dev Emitted when a credentials group member is updated.
    /// @param credentialId: Id of the credential.
    /// @param credentialsTreeIndex: Identity commitment index within the credentials tree.
    /// @param identityCommitment: Existing identity commitment in the credentials tree to be updated.
    /// @param newIdentityCommitment: New identity commitment.
    /// @param credentialsTreeRoot: New root hash of the credentials tree.
    event CredentialMemberUpdated(
        uint256 indexed credentialId,
        uint256 credentialsTreeIndex,
        uint256 identityCommitment,
        uint256 newIdentityCommitment,
        uint256 credentialsTreeRoot
    );

    /// @dev Emitted when a no-credentials group member is updated.
    /// @param credentialId: Id of the credential.
    /// @param noCredentialsTreeIndex: Identity commitment index within the no-credentials tree.
    /// @param identityCommitment: Existing identity commitment in the no-credentials tree to be updated.
    /// @param newIdentityCommitment: New identity commitment.
    /// @param noCredentialsTreeRoot: New root hash of the no-credentials tree.
    event NoCredentialMemberUpdated(
        uint256 indexed credentialId,
        uint256 noCredentialsTreeIndex,
        uint256 identityCommitment,
        uint256 newIdentityCommitment,
        uint256 noCredentialsTreeRoot
    );

    /// @dev Emitted when a new grade commitment within the grade tree is removed.
    /// @param credentialId: Id of the credential.
    /// @param gradeTreeIndex: Grade commitment index within the grade tree.
    /// @param gradeCommitment: Existing grade commitment in the grade tree to be removed.
    /// @param gradeTreeRoot: New root hash of the grade tree.
    event GradeMemberRemoved(
        uint256 indexed credentialId,
        uint256 gradeTreeIndex,
        uint256 gradeCommitment,
        uint256 gradeTreeRoot
    );

    /// @dev Emitted when a new identity commitment within the credentials tree is removed.
    /// @param credentialId: Id of the credential.
    /// @param credentialsTreeIndex: Identity commitment index within the credentials tree.
    /// @param identityCommitment: Existing identity commitment in the credentials tree to be removed.
    /// @param credentialsTreeRoot: New root hash of the credentials tree.
    event CredentialMemberRemoved(
        uint256 indexed credentialId,
        uint256 credentialsTreeIndex,
        uint256 identityCommitment,
        uint256 credentialsTreeRoot
    );

    /// @dev Emitted when a new identity commitment within the no-credentials tree is removed.
    /// @param credentialId: Id of the credential.
    /// @param noCredentialsTreeIndex: Identity commitment index within the no-credentials tree.
    /// @param identityCommitment: Existing identity commitment in the no-credentials tree to be removed.
    /// @param noCredentialsTreeRoot: New root hash of the no-credentials tree.
    event NoCredentialMemberRemoved(
        uint256 indexed credentialId,
        uint256 noCredentialsTreeIndex,
        uint256 identityCommitment,
        uint256 noCredentialsTreeRoot
    );

    /// @dev Defines a new credential as per the credential manager specifications.
    /// @param credentialId: Id of the credential.
    /// @param treeDepth: Depth of the trees that define the credential state.
    /// @param credentialData: Data that defines the credential, as per the credential manager specifications.
    function createCredential(
        uint256 credentialId,
        uint256 treeDepth,
        bytes calldata credentialData
    ) external returns (CredentialState memory);

    /// @dev Updates a credential as per the credential manager specifications.
    /// @param credentialId: Id of the credential.
    /// @param credentialState: Current state of the credential.
    /// @param credentialUpdate: Data that defines the credential update, as per the credential manager specifications.
    /// @return CredentialState, new state of the credential.
    function updateCredential(
        uint256 credentialId,
        CredentialState calldata credentialState,
        bytes calldata credentialUpdate
    ) external returns (CredentialState memory);
}
