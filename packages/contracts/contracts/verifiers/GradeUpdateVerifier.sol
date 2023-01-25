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
            [5014879703684439092238998302076753564092812844652842372112030695621944156004,
             10344234000585183753217623853050966348977235087785275265567634937256542207605],
            [13865743627453494389521700539427088107968422996530334728774635255648778939548,
             1581999495290168822192790370291610754429182380485546749424464338740279428726]
        );
        vk.IC = new Pairing.G1Point[](8);
        
        vk.IC[0] = Pairing.G1Point( 
            14889559520217519389326415648200390656844518338544810010848427389566064463927,
            4111088041721237000707543615945672976606896308140322107642353786244628560685
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            6791504260388348567231330184794416043913677925631478001463183150425416687091,
            17719395494223764983621361202745132048496892644875601541092011638148487414999
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            17955213568201532995196883570228013538185753105220425026127893569381408684311,
            15374337279173364479321373857624269159266132065171486308134211843372836047127
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            17070366108632709977377748225143719694418692008208736564766247529925218965690,
            757367020114083483452857392177064404739084874878633094812347404393974959647
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            1262543135191716092881618055686841100551256057288632071586418217929371530495,
            14314578873816366879511022168791883054929790229460505258246755730419132914569
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            21270180265609748214528433507079162703277349518245016833469781103764735822328,
            8243689118963430632372729684165424189888752107547741951969496066297724394260
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            16556619712618024275686641311742669513346691191236421623054020443188065238504,
            14387861778678962848206806090347919873804735082093310837134327100329386809476
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            13591571893234552023732841952876547242995099537092514540062007624140028915752,
            11665990433000821295271512881872007848358031553553284895961370237416581693795
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
