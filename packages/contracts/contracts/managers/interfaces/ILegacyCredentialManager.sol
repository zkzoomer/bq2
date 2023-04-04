// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../interfaces/ICredentialManager.sol";

interface ILegacyCredentialManager is ICredentialManager {
    error LegacyCredentialDoesNotExist();
}
