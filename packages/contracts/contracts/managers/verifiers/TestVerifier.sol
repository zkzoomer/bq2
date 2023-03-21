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

import "../interfaces/ITestVerifier.sol";

contract TestVerifier is ITestVerifier {
    using PairingLib for *;
    
    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = PairingLib.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = PairingLib.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132, 6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679, 10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );

        vk.gamma2 = PairingLib.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634, 10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531, 8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );

        vk.delta2 = PairingLib.G2Point(
            [5838312785892005501726937353397436047787339137902395956460315438405727526648, 15945498204769215893390901053674218618428668817777262850517154736086607420097],
            [7429541588727472954230173118584255267228618177215802970437427013623373732676, 3492410585732505953225832323057862808853484179848655621914663160499227313421]
        );

        vk.IC = new PairingLib.G1Point[](11);

            
        vk.IC[0] = PairingLib.G1Point(
            15701663590014921532921960813024076515886450481041981352973071644628957473885,
            4029702578219577355115054213159511197918112798336489277312432195437629346817
        );
            
        vk.IC[1] = PairingLib.G1Point(
            11411298893507778768336411773838968844659532549412067564558799462375959797095,
            10883970276499694761788988875416554326109978475435934452151304707463117068975
        );
        
        vk.IC[2] = PairingLib.G1Point(
            1657441127695113463529209762911849146841225886309275570893822196612029371732,
            10874417601615041302352521596020387512033194820636514702063861556248080825588
        );
        
        vk.IC[3] = PairingLib.G1Point(
            17607850747391341893026091408980065582429471212100689784395431754124259109194,
            16688303949459255693399421892987011114075359691366181809552376455687109369446
        );
        
        vk.IC[4] = PairingLib.G1Point(
            11572082814276390223512472734823186365819913031800277669751535038606453949292,
            21525510712377249581951761853570902634635069971403517775817444904352008555342
        );
        
        vk.IC[5] = PairingLib.G1Point(
            21204928170726277593552043219174579204073686950798675036234612605037073736476,
            2659881797694149387503429734998373655623868181360190277682447753253710279594
        );
        
        vk.IC[6] = PairingLib.G1Point(
            10772037888198166136018674235480352098674793982056761284820438114241261609126,
            20182667549757899077322548004901568873857241075530987939066314357479282993026
        );
        
        vk.IC[7] = PairingLib.G1Point(
            12337706999080323854295315910607030000381520032870032279255049676917325863519,
            6972646636366142138679204120770062855354552378861769746846311381920140415565
        );
        
        vk.IC[8] = PairingLib.G1Point(
            18940299556498154953678453716188790194410692603814034563696314566209848083753,
            7803244552057865178378377026699298263752062733835846028274845474083602953132
        );
        
        vk.IC[9] = PairingLib.G1Point(
            17088593136992153437302524853047591525887337200256155839884102126300941605365,
            1803668846264618363435548357436383698719943509141728457626220829104269687018
        );
        
        vk.IC[10] = PairingLib.G1Point(
            17738932611525213992745645311482081757330800695433582791577884618493521158673,
            6032819592984899501611611506264574089620242223369852548605797584620768352928
        );                                      
    }
    
    function verify(uint[10] memory input, Proof memory proof) internal view returns (uint) {
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
    
    function verifyProof(
        uint[8] calldata _proof,
        uint[10] memory input
    ) external view override {
        Proof memory proof;
        proof.A = PairingLib.G1Point(_proof[0], _proof[1]);
        proof.B = PairingLib.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
        proof.C = PairingLib.G1Point(_proof[6], _proof[7]);
        
        if (verify(input, proof) != 0) {
            revert InvalidProof();
        }
    }
}