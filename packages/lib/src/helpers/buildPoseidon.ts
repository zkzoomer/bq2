// @ts-ignore
import { buildPoseidon as build } from "circomlibjs";

type BigNumberish = string | number | bigint;
export type Poseidon = (inputs: any[]) => bigint;

let poseidon: any;

export async function buildPoseidon() {
	if (!poseidon) poseidon = await build();

	return (inputs: BigNumberish[]) => {
		const hash = poseidon(inputs.map((x) => BigInt(x)));
		const hashStr = poseidon.F.toString(hash);
		return BigInt(hashStr);
	};
}
