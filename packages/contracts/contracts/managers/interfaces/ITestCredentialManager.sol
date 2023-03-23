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

    error TestCredentialDoesNotExist();
    error TestCredentialWasInvalidated();
    error TimeLimitReached();
}
