<?php
/**
 * RWA Platform - JWT Helper
 */

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function makeJwt(string $address, bool $mfa = false): string {
    $payload = [
        'address' => $address,
        'mfa'     => $mfa ? 1 : 0,
        'iat'     => time(),
        'exp'     => time() + ($mfa ? 43200 : 604800), // 12h or 7d
    ];
    return JWT::encode($payload, JWT_SECRET, 'HS256');
}

function makeAdminJwt(string $username): string {
    $payload = [
        'role'     => 'admin',
        'username' => $username,
        'iat'      => time(),
        'exp'      => time() + 43200, // 12h
    ];
    return JWT::encode($payload, ADMIN_JWT_SECRET, 'HS256');
}

function decodeJwt(string $token, string $secret): ?array {
    try {
        $decoded = JWT::decode($token, new Key($secret, 'HS256'));
        return (array)$decoded;
    } catch (Throwable) {
        return null;
    }
}
