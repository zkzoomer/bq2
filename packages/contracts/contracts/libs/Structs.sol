// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// It defines the current state of the credential
struct CredentialState {
    /// Leaf index of the next empty credentials tree leaf
    uint80 credentialsTreeIndex;
    /// Leaf index of the next empty no-credentials tree leaf
    uint80 noCredentialsTreeIndex;
    /// Leaf index of the next empty grade tree leaf
    uint80 gradeTreeIndex;
    /// Root hash of the grade tree
    uint256 gradeTreeRoot;
    /// Root hash of the credentials tree
    uint256 credentialsTreeRoot;
    /// Root hash of the no credentials tree root
    uint256 noCredentialsTreeRoot;
}

/// It specifies the parameters that define a credential
struct CredentialParameters {
    /// Depth of the trees making up the different groups
    uint256 treeDepth;
    /// Type of the credential, which is mapped to the corresponding manager
    uint256 credentialType;
    /// Merkle root validity duration in minutes
    uint256 merkleTreeDuration;
    /// Creation timestamp for the different Merkle roots the credential groups gets
    mapping(uint256 => uint256) merkleRootCreationDates;
    /// Used nullifier hashes when generating Semaphore inclusion/grade claim proofs
    mapping(uint256 => bool) nullifierHashes;
}

/// It defines the credential rating
struct CredentialRating {
    /// Sum of all the ratings the credential has received
    uint128 totalRating;
    /// Number of times the credential has been rated
    uint128 nRatings;
}
