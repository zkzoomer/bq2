//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "../interfaces/IGradeUpdateVerifier.sol";

contract GradeUpdateVerifier is IGradeUpdateVerifier {
    using Pairing for *;

    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [4030094362072856496967707322635125464394941034112099628787817259147863123878,
             18741248591850243519321513702786621173339763776154743260780821125235146504609],
            [7694975104996648686646861989950690514884380980408569015672684403455760543214,
             3793189929488329370383736663667520841592470191453940288060974220154561594011]
        );
        vk.IC = new Pairing.G1Point[](8);
        
        vk.IC[0] = Pairing.G1Point( 
            14140085190764688774961407030429203386275105645727339394289147925509077204382,
            20071267264966433935008264174527242072057218883563479101643058430465187251221
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            6633819649066970199198387592269498481647890510047418653169641093209922475270,
            18758453581456262319575253373511713969461560266099090556553982299397954912014
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            2914358310365994372996114141770619236818226963269515734488266362989303772119,
            12566091427938663378400577112864812195225936009771073271569489824910937674843
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            3962084062475755571283019974478427473378391858941233375481840119155939315103,
            334113005005635958569969402412214680145111437656172410609921900737543767113
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            4723217725315169148227918205206002734471352690079491713330373677454842627979,
            16668216835228327634775994012251395434026998767019717510834060330807229706874
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            11767417424505370063668252512276258320198211037213653577387589681097224180503,
            7095147764651544726463203095853047771732055326989835619114166554905545555780
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            20669861128209952010951511685124772886429009479630891679244625395558266354063,
            5916397488544268544842831309959705139419636687640022488745672837719433536734
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            10949558729434988885956765972952172470788678988612021413384997066131404991428,
            12729046834849507301368351309546590982730067237130551765453343882791513481397
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[7] memory input
        ) public view override returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}

