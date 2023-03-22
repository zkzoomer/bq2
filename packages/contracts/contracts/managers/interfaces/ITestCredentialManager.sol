// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../interfaces/ICredentialManager.sol";
import { CredentialTest, TestInitializingParameters } from "../libs/Structs.sol";

interface ITestCredentialManager is ICredentialManager {
    error CannotRequireSameCredential();
    error GradeRestrictedTestsMustSpecifyRequiredCredential();
    error TimeLimitIsInThePast();
    error InvalidNumberOfQuestions();
    error InvalidMinimumGrade();
    error InvalidMultipleChoiceWeight();

    error CredentialTestAnswersAlreadyVerified();
    error InvalidCredentialTestAnswersLength();

    error TestCredentialDoesNotExist();
    error TestCredentialWasInvalidated();
    error TimeLimitReached();

    /// @dev Stores the open answer hashes on-chain, "verifying" the corresponding credential test.
    /// A check can be made to see if these correspond to the openAnswerHashesRoot, or assume it's in
    /// the credential issuer's best interest to provide the valid open answer hashes.
    /// @param credentialId: Id of the credential.
    /// @param answerHashes: Array containing the hashes of each of the answers of the test.
    function verifyTestCredentialAnswers(
        uint256 credentialId,
        uint256[] memory answerHashes
    ) external;

    /// @dev Returns the open answer hashes of a given credential test.
    /// @param credentialId: Id of the credential.
    /// @return uint256[], open answer hashes.
    function getOpenAnswersHashes(uint256 credentialId) external view returns (uint256[] memory);
}
