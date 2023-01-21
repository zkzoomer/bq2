pragma circom 2.0.0;

include "./verifiers/verify_multiple_choice.circom";

// Answer verifier for a maximum of 64 multiple choice questions
component main {public [solutionHash]} = VerifyMultipleChoice(6);