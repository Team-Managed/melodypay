// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INameWrapper
 * @notice Interface for the official ENS NameWrapper contract
 * @dev See https://docs.ens.domains/wrapper/contracts
 *      Mainnet: 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401
 *      Sepolia: 0x0635513f179D50A207757E05759CbD106d7dFcE8
 */
interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setChildExpiry(
        bytes32 parentNode,
        bytes32 labelhash,
        uint64 expiry
    ) external;

    function getData(uint256 id) external view returns (address owner, uint32 fuses, uint64 expiry);
}
