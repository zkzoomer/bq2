import { BigNumber } from "@ethersproject/bignumber"
import { BytesLike, Hexable, zeroPad } from "@ethersproject/bytes"
import { keccak256 } from "@ethersproject/keccak256"
import { utils } from "ethers"
import { formatBytes32String, toUtf8Bytes } from "@ethersproject/strings"

export function hash(message: BytesLike | Hexable | number | bigint | string): string {
    if (message === "") {
        return (BigInt(utils.keccak256(formatBytes32String(message))) >> BigInt(8)).toString()
    }

    if (typeof message === 'string' && isNaN(message as any)) {
        if (toUtf8Bytes(message).length > 31) {
            return (BigInt(keccak256(toUtf8Bytes(message))) >> BigInt(8)).toString()
        }

        message = formatBytes32String(message)
    }

    message = BigNumber.from(message).toTwos(256).toHexString()
    message = zeroPad(message, 32)

    return (BigInt(keccak256(message)) >> BigInt(8)).toString()
}
