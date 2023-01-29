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

import "../lib/Pairing.sol";

contract GradeUpdateVerifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }
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
            [12344149222272698655860760607082040033115450835176504117118534488081143226590,
             15215911048307266401541974924262547653199876587120512599319878499675183347729],
            [16235468857777740852222376081172024403911849556010570538567488109968147259491,
             12461820609789853059695573404856738685259801541664048446891136049493016845946]
        );
        vk.IC = new Pairing.G1Point[](8);
        
        vk.IC[0] = Pairing.G1Point( 
            7847383660516306061775871467797163586683079639961215240093944692026460229805,
            3628650991466789879853827601820663184397856634943349096706939226137788475816
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            4376646117335350439603018376643293315253362031600582664175007898188826208970,
            1929723272959679017291274171639512421402672856147743143791648662714837173558
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            16953717438156930411008504339751158530310416651712937870954933722606900655770,
            20870817322349249373253268433252248696102432440724903760281497246042564774649
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            2914358310365994372996114141770619236818226963269515734488266362989303772119,
            12566091427938663378400577112864812195225936009771073271569489824910937674843
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            3962084062475755571283019974478427473378391858941233375481840119155939315103,
            334113005005635958569969402412214680145111437656172410609921900737543767113
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            4775153691709717406228495748930132993229503308788378208393949604905312688043,
            1990953711317073063221340810781481858605679256522156894916528596529699653704
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            9082601468435367169230764520114845712696116691969168684736500484127278484782,
            6008916034633172976689764785968032002268624140609951017176913196197925523317
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            9172699276927416458808415816431478468070579596834404470676964491507028873678,
            340510430727772120326281061448025480463272755453517188765867620397174179523
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
        ) public view returns (bool r) {
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
