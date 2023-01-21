pragma circom 2.0.0;

include "./verifiers/verify_open_answers.circom";

// Answer verifier for a maximum of 64 open answer questions
component main {public [answersHashesRoot]} = VerifyOpenAnswers(6);