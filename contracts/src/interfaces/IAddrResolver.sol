// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAddrResolver {
    event AddrChanged(bytes32 indexed node, address a);

    function setAddr(bytes32 node, address a) external;
    function addr(bytes32 node) external view returns (address payable);
}
