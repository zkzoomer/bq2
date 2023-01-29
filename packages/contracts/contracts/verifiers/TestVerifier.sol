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

contract TestVerifier {
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
            [13507210822889461519737085463031817755906187017476608887094066477402727606726,
             18991899437523870820525956787591896072206730736260246494748786739473151299722],
            [16079171919789867158165802708406235574608607146847666859363890929151959301691,
             18396253187742289020140242780780520309085956037737638666307392848077400818242]
        );
        vk.IC = new Pairing.G1Point[](11);
        
        vk.IC[0] = Pairing.G1Point( 
            17636542791572686777330759891298677353071938408226390135041929239327926221677,
            21430860116475795446545822141930880776308440556112150872958000489712756765429
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            13788554862888395167135556850741639512841306418620447880710621944339897888122,
            16833471633428039406046495096302130183183499277509575470481079076191102736650
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            11615683461613465417545317947041972059215657381019922491560601806249233179363,
            3190123106991469335459784556754888417510835102596137449193161486984394997521
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            3107480149179144449475223500513236200009767378952642400899634888489747582601,
            7393462394476740286214899917236036224881546214456514649490406094939501692536
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            10898280078968084489599352548991547433789241168391553931215915408860291402273,
            18550088748564475128848541719576612312535726626176214332133933973268116508072
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10398925695298447295995718263605125794152347462427586510749339868965973065052,
            2683570059547889103542360859857311116408310071449910139977381717233943428633
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            8209825918822917689842935161547012811631140028495626068095975994412371907445,
            6883072257453987520605448174648940487115547709114799204459425368185455452826
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            6220560579503490603946672930988240413679220175319588557520862085879401665277,
            9343558762253922412752493972064136997175924058277884772260657560142533423542
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            10338083974722885098635529857872319993937053788383276726902453878458721891988,
            7338348057264020743836627263653806286966882330025758289819890609408878446430
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            10738086864358462857121754977117501112938415097708695267072587292332638829332,
            1087373465220482022534020663950804748217324194256761069757152174412154302816
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            14421578469127381683058733822414280475501562081883305493070661036495690825696,
            19693141184795604483789520363901032689956382245332829548581100835768708425625
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
            uint[10] memory input
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

