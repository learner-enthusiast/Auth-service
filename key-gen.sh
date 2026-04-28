#!/usr/bin/env bash

set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: ./key-gen.sh [options]

Generates an RSA keypair suitable for OIDC/JWT signing and writes:
	- private key (PEM)
	- public key (PEM)
	- JWKS (JSON) derived from the public key

Options:
	-o, --out-dir <dir>     Output directory for PEM/JWKS (default: ./keys/oidc)
	--jwks-out <path>       Where to write the JWKS JSON (default: public/.well-known/jwks.json)
	--kid <kid>             Key ID (default: random)
	--bits <n>              RSA bits (default: 2048)
	--alg <alg>             JWA alg (default: RS256)
	-h, --help              Show this help

Examples:
	./key-gen.sh
	./key-gen.sh --kid my-key-1 --bits 3072
	./key-gen.sh -o ./keys/auth --jwks-out ./public/.well-known/jwks.json
USAGE
}

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

OUT_DIR="./keys/oidc"
JWKS_OUT="./public/.well-known/jwks.json"
KID=""
BITS="2048"
ALG="RS256"

while [[ $# -gt 0 ]]; do
	case "$1" in
		-o|--out-dir)
			OUT_DIR="$2"
			shift 2
			;;
		--jwks-out)
			JWKS_OUT="$2"
			shift 2
			;;
		--kid)
			KID="$2"
			shift 2
			;;
		--bits)
			BITS="$2"
			shift 2
			;;
		--alg)
			ALG="$2"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

need_cmd openssl
need_cmd node

if [[ -z "$KID" ]]; then
	KID="$(openssl rand -hex 16)"
fi

mkdir -p "$OUT_DIR"

PRIVATE_KEY="$OUT_DIR/private.pem"
PUBLIC_KEY="$OUT_DIR/public.pem"
JWKS_LOCAL="$OUT_DIR/jwks.json"
KID_FILE="$OUT_DIR/kid.txt"

echo "Generating RSA ${BITS}-bit keypair..."

# PKCS8 private key
openssl genpkey -algorithm RSA \
	-pkeyopt "rsa_keygen_bits:${BITS}" \
	-out "$PRIVATE_KEY"

chmod 600 "$PRIVATE_KEY"

# Public key in PEM (SubjectPublicKeyInfo)
openssl pkey -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

echo "$KID" > "$KID_FILE"

echo "Generating JWKS (public only)..."
node --input-type=commonjs - "$PUBLIC_KEY" "$KID" "$ALG" "$JWKS_LOCAL" <<'NODE'
const fs = require('fs');
const jose = require('node-jose');

(async () => {
	const [pubPath, kid, alg, outPath] = process.argv.slice(2);
	const publicPem = fs.readFileSync(pubPath, 'utf8');

	const keystore = jose.JWK.createKeyStore();
	await keystore.add(publicPem, 'pem', { kid, use: 'sig', alg });

	fs.writeFileSync(outPath, JSON.stringify(keystore.toJSON(), null, 2) + '\n');
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
NODE

mkdir -p "$(dirname "$JWKS_OUT")"
cp "$JWKS_LOCAL" "$JWKS_OUT"

cat <<EOF
Done.

Private key:  $PRIVATE_KEY
Public key:   $PUBLIC_KEY
KID:          $KID (also in $KID_FILE)
JWKS (local): $JWKS_LOCAL
JWKS (OIDC):  $JWKS_OUT

IMPORTANT: Do NOT commit the private key.
EOF
