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

import "../interfaces/IGradeClaimVerifier.sol";

contract GradeClaimVerifier is IGradeClaimVerifier {
    using PairingLib for *;
    
    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = PairingLib.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = PairingLib.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = PairingLib.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = PairingLib.G2Point(
            [2180008174893731746272352278556387529918406743146590631710689356460021610216,
             21068140153252693389132883234139741713854518407659604275644382535250143632397],
            [20257831419748681258492600857160368407173734700507798301328630013535279577516,
             15867570365255182200104438408897851726064397890039529863707685623058117090576]
        );
        vk.IC = new PairingLib.G1Point[](6);
        
        vk.IC[0] = PairingLib.G1Point( 
            18155327776846209636927181614450861073508060708785872929820707213388090843339,
            20561153919292129803359061365880065126171815834877256000998327185699301442784
        );                                      
        
        vk.IC[1] = PairingLib.G1Point( 
            17372934225166668031417248775285194607013608569835293893526819508134694841053,
            14616137450428448153786468732022862570837339221147328365514021540875298222893
        );                                      
        
        vk.IC[2] = PairingLib.G1Point( 
            9414923662869247587701611121078281416980257599006687187147315415984014840760,
            1087488520128824835990186903085697005545478768728331718841730843108173516365
        );                                      
        
        vk.IC[3] = PairingLib.G1Point( 
            260330406314361093538445519869534788880080141505190580488684542187849835832,
            11723728597238239807021122267811356546860823147925948657626059850771033935277
        );                                      
        
        vk.IC[4] = PairingLib.G1Point( 
            18755565117040434825327328938507152207023565439344796328841717442535775294649,
            5860199498907599666754133636016764351730863753910674921006544272180161901422
        );                                      
        
        vk.IC[5] = PairingLib.G1Point( 
            20707054143389630298211755572835227066994995189139214678745076287833772915326,
            4016480759137731818580301673096201009048430972341086942201058394540093052817
        );                                     
    }

    function verify(uint[5] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        PairingLib.G1Point memory vk_x = PairingLib.G1Point(0, 0);
        for (uint i = 0; i < input.length; ) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = PairingLib.addition(vk_x, PairingLib.scalar_mul(vk.IC[i + 1], input[i]));
        
            unchecked {
                ++i;
            }
        }
        vk_x = PairingLib.addition(vk_x, vk.IC[0]);
        if (!PairingLib.pairingProd4(
            PairingLib.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[8] calldata _proof,
            uint[5] memory input
        ) public view override returns (bool r) {
        Proof memory proof;
        proof.A = PairingLib.G1Point(_proof[0], _proof[1]);
        proof.B = PairingLib.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
        proof.C = PairingLib.G1Point(_proof[6], _proof[7]);
        
        if (verify(input, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}