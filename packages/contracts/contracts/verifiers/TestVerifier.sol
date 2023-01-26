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
            [7128686128162763513760624485957220508262877655347953152988162001970545391415,
             14328214066247021155904458330751043781350756261730470768389326740219029503217],
            [4872611471235711292125877417358148096329471613488438119620409003954337226764,
             10390147465416797766000072695580546826465692200951214461229041363718639281468]
        );
        vk.IC = new Pairing.G1Point[](11);
        
        vk.IC[0] = Pairing.G1Point( 
            12771149008439653062921065566759234102461413254867215480361249363865476687933,
            11286587646357925361708218995256402219778141704550044075454583274053218561733
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            9471303046283318233710285541635381908318752403454264112897354163406553892355,
            9469756135506997445742235760294800001264182389030449341559894221873517863896
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            14083589561575139000748034801534064654207746824500337661862164135694838339552,
            18557501418857174068145402529929307658699368929918071743381704827217742393677
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            20727433650144746231415038399134920130664177220409410231310942279368788625411,
            19366549604914087550472248109808287091782475106479055074360272395484799713909
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            298201310988165108080993943932566190025383371103351878049388687925898971803,
            20841636372065310374787950185018343521752099176067518369225932876703743353377
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            15099110937606578711257789811710472659799873154599087368023148850587506309641,
            11541937168153717432772941857788572071597073339481945089039911140740900350723
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14908464121212098542896810286466740111227996608374685338745205896491514002928,
            2552928969166779005904077802023684381621679408484744467528318107596884049289
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            16338579307217697739882620170713996249840631887284531494248831973482985646971,
            11177494570617734581169619747694109585127564603630874300686216928378366219349
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            20315408331941284880878232442078859118414255023394172188988937357410818464601,
            1919394799566586042660066214432010683321311661285561107701406351358767052510
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            20978801918132349633870426486944721130584118382943400528434547004691363499834,
            405461141082451686425227423926732577884697260664061636119079238923351904557
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            10768503006568962424402793345063093830593018814482019584584976640780723416662,
            17062622014951312792440792476266491338608875294432513598413942492450968916567
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
            uint[2] calldata a,
            uint[2][2] calldata b,
            uint[2] calldata c,
            uint[10] calldata input
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
