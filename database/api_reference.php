<?php
/**
 * api_reference.php — Backend PHP completo para HostGator
 *
 * Deploy: public_html/api/index.php
 * PHP requerido: >= 8.0  (match expression, str_starts_with)
 *
 * Instalar Mercado Pago SDK via Composer (no diretório api/):
 *   composer require mercadopago/dx-php
 * Ou usar as chamadas cURL incluídas neste arquivo (sem dependência).
 *
 * Configurar variáveis de ambiente via .env ou cPanel Environment Variables:
 *   DB_HOST           localhost
 *   DB_NAME           alvar028_casamentos
 *   DB_USER           alvar028_user
 *   DB_PASS           sua_senha
 *   MASTER_API_KEY    chave_secreta_para_criar_casais
 *   MP_ACCESS_TOKEN   APP_USR-xxx (obtido em mercadopago.com.br/developers)
 *   MP_WEBHOOK_SECRET segredo_do_webhook_mp (opcional mas recomendado)
 *   SITE_URL          https://seudominio.com.br
 *   MP_SANDBOX        true  (remover ou false em produção)
 *
 * .htaccess no diretório api/:
 *   RewriteEngine On
 *   RewriteCond %{REQUEST_FILENAME} !-f
 *   RewriteRule ^(.*)$ index.php [QSA,L]
 *
 * Cron diário para limpar sessões/reservas expiradas:
 *   0 3 * * * /usr/bin/php /home/alvar028/public_html/api/cron_cleanup.php
 */

// ═══ LOADER DE .env ════════════════════════════════════════════════════════════
// Localização do .env — fora do webroot (acima de public_html/), nunca acessível
// pelo navegador. Mesma lógica no HostGator e em localhost.
//
// HostGator (cPanel):
//   /home/alvar028/             ← home do servidor
//     .env                      ← arquivo aqui
//     public_html/
//       api/
//         index.php             ← este arquivo
//
// Para descobrir o home em qualquer ambiente, usamos $_SERVER['HOME']
// (definido pelo sistema operacional).  Fallback explícito para o caminho
// real do HostGator caso HOME não esteja disponível.
//
// Cada linha: CHAVE=valor  (comentários # e linhas vazias são ignorados)
// Aspas simples ou duplas ao redor do valor são removidas automaticamente.

(static function (): void {
    // Tenta, em ordem:
    // 1. $HOME/.env            — fora do webroot (ideal)
    // 2. dirname(docRoot)/.env — pai do webroot (ex: /home1/alvar028/.env)
    // 3. docRoot/.env          — dentro do webroot (cPanel compartilhado com pasta de domínio)
    $home    = rtrim($_SERVER['HOME'] ?? '', '/');
    $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');

    $candidates = array_filter([
        $home    ? "{$home}/.env"              : '',
        $docRoot ? dirname($docRoot) . '/.env' : '',
        $docRoot ? "{$docRoot}/.env"           : '',
    ]);

    $envFile = '';
    foreach ($candidates as $candidate) {
        if (is_readable($candidate)) { $envFile = $candidate; break; }
    }

    if (!is_readable($envFile)) {
        return;   // sem .env → depende das variáveis já definidas no ambiente
    }

    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2)) + [1 => ''];
        // Remove aspas opcionais ao redor do valor
        if (preg_match('/^([\'"])(.*)\1$/', $value, $m)) {
            $value = $m[2];
        }
        // putenv + $_ENV + $_SERVER para máxima compatibilidade
        // .env sempre tem prioridade — sobrescreve vars do sistema que possam estar vazias
        putenv("{$key}={$value}");
        $_ENV[$key]    = $value;
        $_SERVER[$key] = $value;
    }
})();

// ═══ CONFIGURAÇÃO ══════════════════════════════════════════════════════════════

define('DB_HOST',           getenv('DB_HOST')          ?: 'localhost');
define('DB_NAME',           getenv('DB_NAME')          ?: 'alvar028_casamentos');
define('DB_USER',           getenv('DB_USER')          ?: 'alvar028_user');
define('DB_PASS',           getenv('DB_PASS')          ?: '');
define('MASTER_API_KEY',    getenv('MASTER_API_KEY')   ?: '');
define('MP_ACCESS_TOKEN',   getenv('MP_ACCESS_TOKEN')  ?: '');
define('MP_WEBHOOK_SECRET', getenv('MP_WEBHOOK_SECRET') ?: '');
define('SITE_URL',          rtrim(getenv('SITE_URL') ?: 'https://seudomain.com.br', '/'));
define('MP_WEBHOOK_URL',    SITE_URL . '/api/payments/webhook');
define('MP_SANDBOX',        getenv('MP_SANDBOX') === 'true');

// ═══ BOOTSTRAP ═════════════════════════════════════════════════════════════════

header('Content-Type: application/json; charset=utf-8');

// Permite SITE_URL em produção e localhost (qualquer porta) em desenvolvimento
$origin         = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [SITE_URL];
// Aceita qualquer localhost para facilitar dev local
if (preg_match('#^https?://localhost(:\d+)?$#', $origin) ||
    preg_match('#^https?://127\.0\.0\.1(:\d+)?$#', $origin)) {
    $allowedOrigins[] = $origin;
}
$corsOrigin = in_array($origin, $allowedOrigins, true) ? $origin : SITE_URL;
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Master-Key, X-Signature, X-Request-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $db = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Banco indisponível.']);
    exit;
}

// ═══ ROTEADOR ══════════════════════════════════════════════════════════════════

// Strip both /database (production path) and /api (legacy) from the URI
$path   = preg_replace('#^/(database|api)#', '', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$method = $_SERVER['REQUEST_METHOD'];

if      ($method === 'GET'  && $path === '/config')               handle_get_config($db);
elseif  ($method === 'GET'  && $path === '/rifa/tickets')         handle_rifa_tickets($db);
elseif  ($method === 'POST' && $path === '/rifa/reserve')         handle_rifa_reserve($db);
elseif  ($method === 'POST' && $path === '/rifa/pay-card')        handle_rifa_pay_card($db);
elseif  ($method === 'POST' && $path === '/gifts/contribute')     handle_gifts_contribute($db);
elseif  ($method === 'POST' && $path === '/gifts/pay-card')       handle_gifts_pay_card($db);
elseif  ($method === 'POST' && $path === '/payments/webhook')     handle_mp_webhook($db);
elseif  ($method === 'POST' && $path === '/login')                handle_login($db);
elseif  ($method === 'GET'  && $path === '/rsvp')                 handle_get_rsvp($db);
elseif  ($method === 'POST' && $path === '/rsvp')                 handle_post_rsvp($db);
elseif  ($method === 'GET'  && $path === '/gifts/contributions')  handle_get_contributions($db);
elseif  ($method === 'GET'  && $path === '/gifts/summary')        handle_get_gift_summary($db);
elseif  ($method === 'GET'  && $path === '/dashboard')            handle_dashboard($db);
elseif  ($method === 'POST' && $path === '/couples')              handle_create_couple($db);
elseif  ($method === 'GET'    && $path === '/admin/rifa')          handle_admin_get_rifa($db);
elseif  ($method === 'POST'   && $path === '/admin/rifa/config')   handle_admin_save_rifa_config($db);
elseif  ($method === 'POST'   && $path === '/admin/rifa/prizes')   handle_admin_add_prize($db);
elseif  ($method === 'PUT'    && str_starts_with($path, '/admin/rifa/prizes/'))
                                                                   handle_admin_update_prize($db, substr($path, 19));
elseif  ($method === 'DELETE' && str_starts_with($path, '/admin/rifa/prizes/'))
                                                                   handle_admin_delete_prize($db, substr($path, 19));
elseif  ($method === 'GET'    && $path === '/admin/site')          handle_admin_get_site($db);
elseif  ($method === 'POST'   && $path === '/admin/site/couple')   handle_admin_save_couple($db);
elseif  ($method === 'POST'   && $path === '/admin/site/content')  handle_admin_save_content($db);
elseif  ($method === 'POST'   && $path === '/admin/site/rooms')    handle_admin_save_rooms($db);
elseif  ($method === 'GET'    && $path === '/admin/gifts')         handle_admin_get_gifts($db);
elseif  ($method === 'POST'   && $path === '/admin/gifts')         handle_admin_add_gift($db);
elseif  ($method === 'PUT'    && str_starts_with($path, '/admin/gifts/'))
                                                                   handle_admin_update_gift($db, substr($path, 13));
elseif  ($method === 'DELETE' && str_starts_with($path, '/admin/gifts/'))
                                                                   handle_admin_delete_gift($db, substr($path, 13));
else    { http_response_code(404); echo json_encode(['error' => 'Rota não encontrada.']); }


// ═══ HELPERS — DB / Auth ═══════════════════════════════════════════════════════

function resolve_couple_by_slug(PDO $db, string $slug): string
{
    if (empty($slug)) {
        http_response_code(400);
        exit(json_encode(['error' => 'Parâmetro couple obrigatório.']));
    }
    $stmt = $db->prepare('SELECT id FROM couples WHERE slug = ? AND active = 1 LIMIT 1');
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        exit(json_encode(['error' => 'Casal não encontrado.']));
    }
    return $row['id'];
}

function get_authenticated_couple_id(PDO $db): string
{
    $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (empty($token)) {
        http_response_code(401);
        exit(json_encode(['error' => 'Token ausente.']));
    }
    $stmt = $db->prepare(
        'SELECT couple_id FROM admin_sessions WHERE token = ? AND expires_at > NOW() LIMIT 1'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(401);
        exit(json_encode(['error' => 'Token inválido ou expirado.']));
    }
    return $row['couple_id'];
}

function json_input(): array
{
    return json_decode(file_get_contents('php://input'), true, 512, JSON_BIGINT_AS_STRING) ?: [];
}

function generate_uuid(): string
{
    $data    = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}


// ═══ HELPERS — Mercado Pago (cURL puro — sem SDK) ══════════════════════════════

/**
 * Cria um pagamento Pix via MP Payments API.
 * Retorna array com: id, status, qr_code, qr_code_base64
 */
function mp_create_pix(float $amount, string $description, string $email, string $name, string $idempotency_key): array
{
    $payload = [
        'transaction_amount' => round($amount, 2),
        'description'        => $description,
        'payment_method_id'  => 'pix',
        'payer'              => ['email' => $email, 'first_name' => $name],
        'external_reference' => $idempotency_key,
        'notification_url'   => MP_WEBHOOK_URL,
    ];
    $res = mp_request('POST', '/v1/payments', $payload, "{$idempotency_key}-pix");
    if (empty($res['id'])) {
        throw new RuntimeException('Falha ao criar pagamento Pix no Mercado Pago.');
    }
    return [
        'id'             => (string) $res['id'],
        'status'         => $res['status'] ?? 'pending',
        'qr_code'        => $res['point_of_interaction']['transaction_data']['qr_code']        ?? '',
        'qr_code_base64' => $res['point_of_interaction']['transaction_data']['qr_code_base64'] ?? '',
    ];
}

/**
 * Cria uma preferência de pagamento para cartão (MP Checkout Pro).
 * Retorna array com: preference_id, init_point
 */
function mp_create_preference(float $amount, string $title, string $email, string $external_ref, array $back_urls): array
{
    $payload = [
        'items' => [[
            'title'       => $title,
            'quantity'    => 1,
            'unit_price'  => round($amount, 2),
            'currency_id' => 'BRL',
        ]],
        'payer'                => ['email' => $email],
        'back_urls'            => $back_urls,
        'auto_return'          => 'approved',
        'external_reference'   => $external_ref,
        'notification_url'     => MP_WEBHOOK_URL,
        'statement_descriptor' => 'ALVIN E LARI',
        'binary_mode'          => true,
    ];
    $res = mp_request('POST', '/checkout/preferences', $payload);
    if (empty($res['id'])) {
        throw new RuntimeException('Falha ao criar preferência de pagamento no Mercado Pago.');
    }
    return [
        'preference_id' => $res['id'],
        'init_point'    => MP_SANDBOX ? ($res['sandbox_init_point'] ?? $res['init_point']) : $res['init_point'],
    ];
}

/**
 * Busca dados de um pagamento pelo ID.
 */
function mp_get_payment(string $payment_id): array
{
    return mp_request('GET', "/v1/payments/{$payment_id}");
}

/**
 * Executa chamada HTTP à API do Mercado Pago.
 */
function mp_request(string $method, string $path, array $data = [], string $idempotency_key = ''): array
{
    $url     = "https://api.mercadopago.com{$path}";
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    ];
    if ($idempotency_key) {
        $headers[] = "X-Idempotency-Key: {$idempotency_key}";
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST,       true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    unset($ch); // curl_close() depreciado no PHP 8.5

    if (!$body) {
        throw new RuntimeException("Mercado Pago sem resposta (HTTP {$status}).");
    }

    $decoded = json_decode($body, true, 512, JSON_BIGINT_AS_STRING) ?: [];

    // 4xx = erro de credencial, token inválido, payload malformado etc.
    // Jogamos exceção para que o chamador cancele os tickets em vez de gravar 'pending' silenciosamente.
    if ($status < 200 || $status >= 300) {
        $errMsg = $decoded['message'] ?? $decoded['error'] ?? "HTTP {$status}";
        error_log("[MP] Erro na chamada {$path}: {$errMsg} (HTTP {$status}) body={$body}");
        throw new RuntimeException("Mercado Pago retornou erro: {$errMsg} (HTTP {$status}).");
    }

    return $decoded;
}

/**
 * Mapeia status do MP para nosso ENUM interno.
 */
function map_mp_status(string $mp_status): string
{
    return match ($mp_status) {
        'approved'                                         => 'approved',
        'rejected', 'cancelled', 'refunded', 'charged_back' => 'rejected',
        default                                            => 'pending',
    };
}

/**
 * Verifica assinatura HMAC do webhook MP.
 * Se MP_WEBHOOK_SECRET não estiver configurado, pula a verificação.
 */
function verify_mp_signature(): bool
{
    if (empty(MP_WEBHOOK_SECRET)) {
        return true; // desativar em produção — sempre configure o secret
    }
    $x_sig    = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
    $x_req_id = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
    // PHP converte 'data.id' para 'data_id' em $_GET — precisa parsear QUERY_STRING direto
    preg_match('/(?:^|&)data\.id=([^&]*)/', $_SERVER['QUERY_STRING'] ?? '', $m);
    $data_id  = isset($m[1]) ? urldecode($m[1]) : '';
    if (!$x_sig || !$data_id) {
        return false;
    }
    preg_match('/ts=(\d+)/', $x_sig, $m1);
    preg_match('/v1=([a-f0-9]+)/', $x_sig, $m2);
    $ts  = $m1[1] ?? '';
    $sig = $m2[1] ?? '';
    $manifest = "id:{$data_id};request-id:{$x_req_id};ts:{$ts};";
    return hash_equals(hash_hmac('sha256', $manifest, MP_WEBHOOK_SECRET), $sig);
}


// ═══ HANDLER — Config pública ═════════════════════════════════════════════════

/**
 * GET /api/config?couple=alvin-lari
 *
 * Retorna toda a configuração pública do casal em uma única chamada:
 *   - Dados do casal (nome, data, local, horário)
 *   - Configuração da rifa (preço, total de bilhetes, threshold, prêmios)
 *   - Catálogo de presentes ativo
 *
 * Rota pública — sem autenticação.
 * Cacheable pelo frontend (módulo weddingConfig.ts).
 */
function handle_get_config(PDO $db): void
{
    $couple_id = resolve_couple_by_slug($db, $_GET['couple'] ?? '');

    // ── Dados do casal ─────────────────────────────────────────────────────────
    $stmt = $db->prepare(
        'SELECT name_partner_1, name_partner_2, wedding_date, wedding_time,
                wedding_location, pix_key,
                couple_display_name, home_name, site_intro_title, site_intro_subtitle,
                rooms_config,
                raffle_ticket_price, raffle_total_tickets, raffle_draw_threshold_pct
           FROM alvar028_casamentos.couples WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$couple_id]);
    $couple = $stmt->fetch();

    // ── Prêmios da rifa ────────────────────────────────────────────────────────
    $stmt = $db->prepare(
        'SELECT title, description, display_order
           FROM raffle_prizes
          WHERE couple_id = ? AND active = 1
          ORDER BY display_order ASC'
    );
    $stmt->execute([$couple_id]);
    $prizes = $stmt->fetchAll();

    // ── Catálogo de presentes ──────────────────────────────────────────────────
    $stmt = $db->prepare(
        'SELECT id AS `id`, slug, title, subtitle, description,
                CAST(suggested_amount AS CHAR) AS suggested_amount,
                tag, tag_color, emoji_name
           FROM gift_items
          WHERE couple_id = ? AND active = 1
          ORDER BY display_order ASC'
    );
    $stmt->execute([$couple_id]);
    $gifts_raw = $stmt->fetchAll();

    // ── Monta resposta ─────────────────────────────────────────────────────────
    $gifts = array_map(static function (array $g): array {
        return [
            'id'               => $g['id'],
            'slug'             => $g['slug'],
            'title'            => $g['title'],
            'subtitle'         => $g['subtitle'] ?? '',
            'description'      => $g['description'] ?? '',
            'suggested_amount' => $g['suggested_amount'] !== null ? (float) $g['suggested_amount'] : null,
            'tag'              => $g['tag'] ?? '',
            'tag_color'        => $g['tag_color'] ?? '',
            'emoji_name'       => $g['emoji_name'] ?? 'gift',
        ];
    }, $gifts_raw);

    $raffle_prizes = array_map(static function (array $p): array {
        return [
            'title'       => $p['title'],
            'description' => $p['description'] ?? '',
            'position'    => (int) $p['display_order'],
        ];
    }, $prizes);

    echo json_encode([
        'couple' => [
            'name'            => $couple['couple_display_name'],
            'home_name'       => $couple['home_name'] ?? '',
            'partner1'        => $couple['name_partner_1'],
            'partner2'        => $couple['name_partner_2'],
            'wedding_date'    => $couple['wedding_date'],      // "2026-08-01"
            'wedding_time'    => $couple['wedding_time'],      // "16:00"
            'wedding_location'=> $couple['wedding_location'] ?? '',
            'pix_key'         => $couple['pix_key'] ?? '',
        ],
        'site' => [
            'intro_title'    => $couple['site_intro_title'] ?? '',
            'intro_subtitle' => $couple['site_intro_subtitle'] ?? '',
        ],
        'rooms' => json_decode($couple['rooms_config'] ?? '{}', true) ?: [],
        'raffle' => [
            'ticket_price'          => (float) $couple['raffle_ticket_price'],
            'total_tickets'         => (int)   $couple['raffle_total_tickets'],
            'draw_threshold_pct'    => (float) $couple['raffle_draw_threshold_pct'],
            'prizes'                => $raffle_prizes,
        ],
        'gifts' => $gifts,
    ]);
}


// ═══ HANDLERS — Rifa ═══════════════════════════════════════════════════════════

/**
 * GET /api/rifa/tickets?couple=alvin-lari
 * Retorna bilhetes sold (approved) e pending (não expirados).
 */
function handle_rifa_tickets(PDO $db): void
{
    $couple_id = resolve_couple_by_slug($db, $_GET['couple'] ?? '');

    // Limpa reservas expiradas antes de responder
    $db->prepare("DELETE FROM raffle_tickets WHERE payment_status = 'pending' AND expires_at < NOW()")
       ->execute();

    $stmt = $db->prepare(
        "SELECT ticket_number, payment_status
           FROM raffle_tickets
          WHERE couple_id = ?
            AND payment_status IN ('approved','pending')"
    );
    $stmt->execute([$couple_id]);

    $sold    = [];
    $pending = [];
    foreach ($stmt->fetchAll() as $row) {
        if ($row['payment_status'] === 'approved') {
            $sold[] = (int) $row['ticket_number'];
        } else {
            $pending[] = (int) $row['ticket_number'];
        }
    }

    echo json_encode(compact('sold', 'pending'));
}

/**
 * POST /api/rifa/reserve
 * Body: { ticket_numbers: int[], buyer_name, buyer_email, buyer_phone?, payment_method, couple }
 * Reserva um ou mais bilhetes e cria o pagamento no Mercado Pago.
 */
function handle_rifa_reserve(PDO $db): void
{
    $body = json_input();

    $couple_id = resolve_couple_by_slug($db, $body['couple'] ?? '');
    $name      = substr(trim(strip_tags($body['buyer_name']  ?? '')), 0, 255);
    $email     = filter_var($body['buyer_email'] ?? '', FILTER_VALIDATE_EMAIL);
    $phone     = substr(trim(strip_tags($body['buyer_phone'] ?? '')), 0, 50);
    $method    = in_array($body['payment_method'] ?? '', ['pix', 'credit_card'], true)
                 ? $body['payment_method'] : null;

    // Suporta ticket_numbers (array) ou ticket_number (legado)
    $raw     = $body['ticket_numbers'] ?? ($body['ticket_number'] ? [$body['ticket_number']] : []);
    $tickets = array_values(array_unique(array_filter(array_map('intval', (array) $raw))));
    $count   = count($tickets);

    if ($count < 1 || $count > 10 || !$name || !$email || !$method) {
        http_response_code(422);
        echo json_encode(['error' => 'Dados inválidos. Selecione entre 1 e 10 bilhetes e preencha nome e e-mail.']);
        return;
    }

    // Preço lido do banco — nunca hardcoded
    $price_row = $db->prepare('SELECT raffle_ticket_price FROM couples WHERE id = ? LIMIT 1');
    $price_row->execute([$couple_id]);
    $unit_price   = (float) ($price_row->fetchColumn() ?: 18.00);
    $total_amount = $unit_price * $count;

    // ── Reserva atômica via transação ──────────────────────────────────────────
    $db->beginTransaction();
    try {
        // Limpa reservas expiradas
        $db->prepare("DELETE FROM raffle_tickets WHERE payment_status = 'pending' AND expires_at < NOW()")
           ->execute();

        // Verifica se algum bilhete está tomado
        $placeholders = implode(',', array_fill(0, $count, '?'));
        $chk = $db->prepare(
            "SELECT ticket_number FROM raffle_tickets
              WHERE couple_id = ? AND ticket_number IN ({$placeholders})
                AND payment_status IN ('approved','pending')"
        );
        $chk->execute([$couple_id, ...$tickets]);
        $taken = $chk->fetchAll(PDO::FETCH_COLUMN);
        if ($taken) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode([
                'error' => 'Bilhetes já reservados: #' . implode(', #', array_map(fn($n) => str_pad($n, 3, '0', STR_PAD_LEFT), $taken)) . '. Remova-os e tente novamente.',
                'taken' => array_map('intval', $taken),
            ]);
            return;
        }

        // Insere uma linha por bilhete (expiram em 30 minutos)
        $group_id  = generate_uuid();
        $ticket_ids = [];
        $insert = $db->prepare(
            "INSERT INTO raffle_tickets
               (id, couple_id, ticket_number, buyer_name, buyer_email, buyer_phone,
                payment_method, payment_status, amount, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?,
                     DATE_ADD(NOW(), INTERVAL 30 MINUTE))"
        );
        foreach ($tickets as $t) {
            $tid = generate_uuid();
            $ticket_ids[] = $tid;
            $insert->execute([$tid, $couple_id, $t, $name, $email, $phone ?: null, $method, $unit_price]);
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao reservar bilhetes. Tente novamente.']);
        return;
    }

    // ── Cria pagamento no Mercado Pago (fora da transação) ────────────────────
    $external_ref = "rifa-group-{$group_id}";
    if ($count === 1) {
        $description = sprintf("Bilhete #%03d — Rifa Chá de Casa Nova", $tickets[0]);
    } else {
        $nums = implode(', #', array_map(fn($n) => str_pad($n, 3, '0', STR_PAD_LEFT), $tickets));
        $description = "{$count} Bilhetes (#$nums) — Rifa Chá de Casa Nova";
    }

    try {
        if ($method === 'pix') {
            $pix = mp_create_pix($total_amount, $description, $email, $name, $external_ref);

            // Associa todos os bilhetes ao mesmo mp_payment_id
            $id_list = implode(',', array_fill(0, count($ticket_ids), '?'));
            $db->prepare("UPDATE raffle_tickets SET mp_payment_id = ? WHERE id IN ({$id_list})")
               ->execute([$pix['id'], ...$ticket_ids]);

            http_response_code(201);
            echo json_encode([
                'method' => 'pix',
                'data'   => [
                    'payment_id'     => $pix['id'],
                    'ticket_ids'     => $ticket_ids,
                    'qr_code'        => $pix['qr_code'],
                    'qr_code_base64' => $pix['qr_code_base64'],
                ],
            ]);
        } else {
            $back_urls = [
                'success' => SITE_URL . '/rifa?payment=success&ref=' . urlencode($external_ref),
                'failure' => SITE_URL . '/rifa?payment=failure',
                'pending' => SITE_URL . '/rifa?payment=pending&ref=' . urlencode($external_ref),
            ];
            $pref = mp_create_preference($total_amount, $description, $email, $external_ref, $back_urls);

            $id_list = implode(',', array_fill(0, count($ticket_ids), '?'));
            $db->prepare("UPDATE raffle_tickets SET mp_preference_id = ? WHERE id IN ({$id_list})")
               ->execute([$pref['preference_id'], ...$ticket_ids]);

            http_response_code(201);
            echo json_encode([
                'method' => 'credit_card',
                'data'   => [
                    'preference_id' => $pref['preference_id'],
                    'ticket_ids'    => $ticket_ids,
                    'init_point'    => $pref['init_point'],
                ],
            ]);
        }
    } catch (RuntimeException $e) {
        // MP falhou — cancela todas as reservas para liberar os números
        $id_list = implode(',', array_fill(0, count($ticket_ids), '?'));
        $db->prepare("UPDATE raffle_tickets SET payment_status = 'cancelled' WHERE id IN ({$id_list})")
           ->execute($ticket_ids);
        http_response_code(502);
        echo json_encode(['error' => 'Falha ao conectar com Mercado Pago. Tente novamente.']);
    }
}


// ═══ HANDLERS — Presentes ══════════════════════════════════════════════════════

/**
 * POST /api/gifts/contribute
 * Body: { gift_item_id, gift_title, amount, contributor_name?, contributor_email, payment_method, couple }
 */
function handle_gifts_contribute(PDO $db): void
{
    $body = json_input();

    $couple_id    = resolve_couple_by_slug($db, $body['couple'] ?? '');
    $gift_item_id = $body['gift_item_id'] ?? null;
    $gift_title   = substr(strip_tags($body['gift_title'] ?? ''), 0, 255);
    $amount       = (float) ($body['amount'] ?? 0);
    $name         = substr(strip_tags($body['contributor_name'] ?? ''), 0, 255) ?: null;
    $email        = filter_var($body['contributor_email'] ?? '', FILTER_VALIDATE_EMAIL);
    $method       = in_array($body['payment_method'] ?? '', ['pix', 'credit_card'], true)
                    ? $body['payment_method'] : null;

    if (!$gift_title || $amount < 1 || !$email || !$method) {
        http_response_code(422);
        echo json_encode(['error' => 'Dados inválidos.']);
        return;
    }

    $contribution_id = generate_uuid();
    $external_ref    = "gift-{$contribution_id}";

    // Insere contribuição como pendente
    $db->prepare(
        "INSERT INTO gift_contributions
           (id, couple_id, gift_item_id, gift_title, amount, contributor, contributor_email,
            payment_method, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    )->execute([
        $contribution_id, $couple_id, $gift_item_id, $gift_title,
        $amount, $name, $email, $method,
    ]);

    $description = "Presente: {$gift_title}";

    try {
        if ($method === 'pix') {
            $pix = mp_create_pix($amount, $description, $email, $name ?? 'Anônimo', $external_ref);

            $db->prepare('UPDATE gift_contributions SET mp_payment_id = ? WHERE id = ?')
               ->execute([$pix['id'], $contribution_id]);

            http_response_code(201);
            echo json_encode([
                'method' => 'pix',
                'data'   => [
                    'payment_id'      => $pix['id'],
                    'contribution_id' => $contribution_id,
                    'qr_code'         => $pix['qr_code'],
                    'qr_code_base64'  => $pix['qr_code_base64'],
                ],
            ]);
        } else {
            $back_urls = [
                'success' => SITE_URL . '/?payment=success',
                'failure' => SITE_URL . '/?payment=failure',
                'pending' => SITE_URL . '/?payment=pending',
            ];
            $pref = mp_create_preference($amount, $description, $email, $external_ref, $back_urls);

            $db->prepare('UPDATE gift_contributions SET mp_preference_id = ? WHERE id = ?')
               ->execute([$pref['preference_id'], $contribution_id]);

            http_response_code(201);
            echo json_encode([
                'method' => 'credit_card',
                'data'   => [
                    'preference_id'   => $pref['preference_id'],
                    'contribution_id' => $contribution_id,
                    'init_point'      => $pref['init_point'],
                ],
            ]);
        }
    } catch (RuntimeException $e) {
        $db->prepare('DELETE FROM gift_contributions WHERE id = ?')->execute([$contribution_id]);
        http_response_code(502);
        echo json_encode(['error' => 'Falha ao conectar com Mercado Pago. Tente novamente.']);
    }
}


// ═══ HANDLERS — Webhook ════════════════════════════════════════════════════════

/**
 * POST /api/payments/webhook
 * Chamado automaticamente pelo Mercado Pago ao mudar status de pagamento.
 * Sempre responde 200 — MP retentar em caso de erro.
 */
function handle_mp_webhook(PDO $db): void
{
    if (!verify_mp_signature()) {
        http_response_code(401);
        echo json_encode(['error' => 'Assinatura inválida.']);
        return;
    }

    $body = json_input();
    if (($body['type'] ?? '') !== 'payment') {
        echo json_encode(['ok' => true]);
        return;
    }

    $payment_id = (string) ($body['data']['id'] ?? '');
    if (!$payment_id) {
        echo json_encode(['ok' => true]);
        return;
    }

    try {
        $payment      = mp_get_payment($payment_id);
        $mp_status    = $payment['status'] ?? 'unknown';
        $new_status   = map_mp_status($mp_status);
        $external_ref = $payment['external_reference'] ?? '';

        if (str_starts_with($external_ref, 'rifa-group-')) {
            // Multi-bilhete: atualiza todos os rows pelo mp_payment_id
            $db->prepare(
                "UPDATE raffle_tickets SET payment_status = ?, updated_at = NOW() WHERE mp_payment_id = ?"
            )->execute([$new_status, $payment_id]);

        } elseif (str_starts_with($external_ref, 'rifa-')) {
            // Legado (bilhete único): external_ref = "rifa-{ticket_id}"
            $ticket_id = substr($external_ref, 5);
            $db->prepare(
                "UPDATE raffle_tickets SET payment_status = ?, mp_payment_id = ?, updated_at = NOW() WHERE id = ?"
            )->execute([$new_status, $payment_id, $ticket_id]);

        } elseif (str_starts_with($external_ref, 'gift-')) {
            $contribution_id = substr($external_ref, 5);
            $db->prepare(
                "UPDATE gift_contributions SET payment_status = ?, mp_payment_id = ? WHERE id = ?"
            )->execute([$new_status, $payment_id, $contribution_id]);
        }
    } catch (RuntimeException $e) {
        // Log silencioso — não retornar erro para evitar retentativas infinitas do MP
        error_log('[MP Webhook] Erro: ' . $e->getMessage());
    }

    http_response_code(200);
    echo json_encode(['ok' => true]);
}


// ═══ HANDLERS — Cartão (Checkout Transparente) ════════════════════════════════

/**
 * POST /api/rifa/pay-card
 * Checkout Transparente: recebe token MP do Brick, cria pagamento síncrono.
 * Body: { token, payment_method_id, installments, issuer_id?,
 *         payer: { email, identification? }, ticket_numbers: int[], buyer_name, couple }
 */
function handle_rifa_pay_card(PDO $db): void
{
    $body = json_input();

    $couple_id         = resolve_couple_by_slug($db, $body['couple'] ?? '');
    $name              = substr(trim(strip_tags($body['buyer_name'] ?? '')), 0, 255);
    $token             = $body['token'] ?? '';
    $payment_method_id = $body['payment_method_id'] ?? '';
    $installments      = max(1, (int) ($body['installments'] ?? 1));
    $issuer_id         = $body['issuer_id'] ?? null;
    $payer_email       = filter_var($body['payer']['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $payer_ident       = $body['payer']['identification'] ?? null;

    // Suporta ticket_numbers (array) ou ticket_number (legado)
    $raw     = $body['ticket_numbers'] ?? ($body['ticket_number'] ? [$body['ticket_number']] : []);
    $tickets = array_values(array_unique(array_filter(array_map('intval', (array) $raw))));
    $count   = count($tickets);

    if ($count < 1 || $count > 10 || !$name || !$token || !$payment_method_id || !$payer_email) {
        http_response_code(422);
        echo json_encode(['error' => 'Dados inválidos.']);
        return;
    }

    // Preço lido do banco — nunca hardcoded
    $price_row = $db->prepare('SELECT raffle_ticket_price FROM couples WHERE id = ? LIMIT 1');
    $price_row->execute([$couple_id]);
    $unit_price   = (float) ($price_row->fetchColumn() ?: 18.00);
    $total_amount = $unit_price * $count;

    // Reserva atômica de todos os bilhetes
    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM raffle_tickets WHERE payment_status = 'pending' AND expires_at < NOW()")->execute();

        $placeholders = implode(',', array_fill(0, $count, '?'));
        $chk = $db->prepare(
            "SELECT ticket_number FROM raffle_tickets
              WHERE couple_id = ? AND ticket_number IN ({$placeholders})
                AND payment_status IN ('approved','pending')"
        );
        $chk->execute([$couple_id, ...$tickets]);
        $taken = $chk->fetchAll(PDO::FETCH_COLUMN);
        if ($taken) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode([
                'error' => 'Bilhetes já reservados: #' . implode(', #', array_map(fn($n) => str_pad($n, 3, '0', STR_PAD_LEFT), $taken)) . '. Remova-os e tente novamente.',
                'taken' => array_map('intval', $taken),
            ]);
            return;
        }

        $group_id   = generate_uuid();
        $ticket_ids = [];
        $insert = $db->prepare(
            "INSERT INTO raffle_tickets
               (id, couple_id, ticket_number, buyer_name, buyer_email,
                payment_method, payment_status, amount, expires_at)
             VALUES (?, ?, ?, ?, ?, 'credit_card', 'pending', ?,
                     DATE_ADD(NOW(), INTERVAL 15 MINUTE))"
        );
        foreach ($tickets as $t) {
            $tid = generate_uuid();
            $ticket_ids[] = $tid;
            $insert->execute([$tid, $couple_id, $t, $name, $payer_email, $unit_price]);
        }

        $db->commit();
    } catch (\Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao reservar bilhetes.']);
        return;
    }

    // Chama MP com o token do Brick
    $external_ref = "rifa-group-{$group_id}";
    if ($count === 1) {
        $description = sprintf("Bilhete #%03d — Rifa Chá de Casa Nova", $tickets[0]);
    } else {
        $nums = implode(', #', array_map(fn($n) => str_pad($n, 3, '0', STR_PAD_LEFT), $tickets));
        $description = "{$count} Bilhetes (#$nums) — Rifa Chá de Casa Nova";
    }

    $unit_price  = $count > 0 ? round($total_amount / $count, 2) : $total_amount;
    $name_parts  = explode(' ', trim($name), 2);
    $payload = [
        'transaction_amount'   => $total_amount,
        'token'                => $token,
        'description'          => $description,
        'installments'         => $installments,
        'payment_method_id'    => $payment_method_id,
        'statement_descriptor' => 'ALVIN E LARI',
        'binary_mode'          => true,   // decisão imediata: approved ou rejected, sem in_process
        'payer'                => [
            'email'      => $payer_email,
            'first_name' => $name_parts[0],
            'last_name'  => $name_parts[1] ?? $name_parts[0],
        ],
        'external_reference'   => $external_ref,
        'notification_url'     => MP_WEBHOOK_URL,
        'capture'              => true,
        'additional_info'      => [
            'items' => [[
                'id'          => 'rifa-bilhete',
                'title'       => $description,
                'description' => $description,
                'category_id' => 'tickets',
                'quantity'    => $count,
                'unit_price'  => $unit_price,
            ]],
        ],
    ];
    if ($issuer_id)   $payload['issuer_id']               = (int) $issuer_id;
    if ($payer_ident) $payload['payer']['identification'] = $payer_ident;

    try {
        $res        = mp_request('POST', '/v1/payments', $payload, "{$group_id}-card");
        $mp_status  = $res['status'] ?? 'unknown';
        $new_status = map_mp_status($mp_status);
        $mp_pay_id  = (string) ($res['id'] ?? '');

        $id_list = implode(',', array_fill(0, count($ticket_ids), '?'));
        $db->prepare(
            "UPDATE raffle_tickets SET payment_status = ?, mp_payment_id = ?, expires_at = NULL WHERE id IN ({$id_list})"
        )->execute([$new_status, $mp_pay_id, ...$ticket_ids]);

        if ($new_status === 'rejected') {
            http_response_code(402);
            echo json_encode([
                'error'  => mp_rejection_message($res['status_detail'] ?? ''),
                'status' => 'rejected',
                'detail' => $res['status_detail'] ?? 'unknown',
            ]);
            return;
        }

        http_response_code(201);
        echo json_encode(['status' => $new_status, 'payment_id' => $mp_pay_id, 'ticket_ids' => $ticket_ids]);

    } catch (\RuntimeException $e) {
        $id_list = implode(',', array_fill(0, count($ticket_ids), '?'));
        $db->prepare("UPDATE raffle_tickets SET payment_status = 'cancelled' WHERE id IN ({$id_list})")
           ->execute($ticket_ids);
        http_response_code(502);
        echo json_encode(['error' => 'Falha ao conectar com Mercado Pago.']);
    }
}

/**
 * POST /api/gifts/pay-card
 * Checkout Transparente para contribuição de presente.
 * Body: { token, payment_method_id, installments, issuer_id?, transaction_amount,
 *         payer: { email, identification? }, gift_item_id, gift_title, contributor_name?, couple }
 */
function handle_gifts_pay_card(PDO $db): void
{
    $body = json_input();

    $couple_id         = resolve_couple_by_slug($db, $body['couple'] ?? '');
    $gift_item_id      = $body['gift_item_id'] ?? null;
    $gift_title        = substr(strip_tags($body['gift_title'] ?? ''), 0, 255);
    $amount            = (float) ($body['transaction_amount'] ?? 0);
    $name              = substr(strip_tags($body['contributor_name'] ?? ''), 0, 255) ?: null;
    $token             = $body['token'] ?? '';
    $payment_method_id = $body['payment_method_id'] ?? '';
    $installments      = max(1, (int) ($body['installments'] ?? 1));
    $issuer_id         = $body['issuer_id'] ?? null;
    $payer_email       = filter_var($body['payer']['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $payer_ident       = $body['payer']['identification'] ?? null;

    if (!$gift_title || $amount < 1 || !$token || !$payment_method_id || !$payer_email) {
        http_response_code(422);
        echo json_encode(['error' => 'Dados inválidos.']);
        return;
    }

    $contribution_id = generate_uuid();
    $external_ref    = "gift-{$contribution_id}";

    $db->prepare(
        "INSERT INTO gift_contributions
           (id, couple_id, gift_item_id, gift_title, amount, contributor, contributor_email,
            payment_method, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'credit_card', 'pending')"
    )->execute([$contribution_id, $couple_id, $gift_item_id, $gift_title, $amount, $name, $payer_email]);

    $gift_description = "Presente: {$gift_title}";
    $gift_name_parts  = $name ? explode(' ', trim($name), 2) : ['Anônimo'];
    $payload = [
        'transaction_amount'   => round($amount, 2),
        'token'                => $token,
        'description'          => $gift_description,
        'installments'         => $installments,
        'payment_method_id'    => $payment_method_id,
        'statement_descriptor' => 'ALVIN E LARI',
        'binary_mode'          => true,
        'payer'                => [
            'email'      => $payer_email,
            'first_name' => $gift_name_parts[0],
            'last_name'  => $gift_name_parts[1] ?? $gift_name_parts[0],
        ],
        'external_reference'   => $external_ref,
        'notification_url'     => MP_WEBHOOK_URL,
        'capture'              => true,
        'additional_info'      => [
            'items' => [[
                'id'          => $gift_item_id ?? 'presente-livre',
                'title'       => "Presente: {$gift_title}",
                'description' => $gift_description,
                'category_id' => 'home_and_garden',
                'quantity'    => 1,
                'unit_price'  => round($amount, 2),
            ]],
        ],
    ];
    if ($issuer_id)   $payload['issuer_id']               = (int) $issuer_id;
    if ($payer_ident) $payload['payer']['identification'] = $payer_ident;

    try {
        $res        = mp_request('POST', '/v1/payments', $payload, "{$contribution_id}-card");
        $mp_status  = $res['status'] ?? 'unknown';
        $new_status = map_mp_status($mp_status);
        $mp_pay_id  = (string) ($res['id'] ?? '');

        $db->prepare(
            "UPDATE gift_contributions SET payment_status = ?, mp_payment_id = ? WHERE id = ?"
        )->execute([$new_status, $mp_pay_id, $contribution_id]);

        if ($new_status === 'rejected') {
            http_response_code(402);
            echo json_encode([
                'error'  => mp_rejection_message($res['status_detail'] ?? ''),
                'status' => 'rejected',
                'detail' => $res['status_detail'] ?? 'unknown',
            ]);
            return;
        }

        http_response_code(201);
        echo json_encode(['status' => $new_status, 'payment_id' => $mp_pay_id, 'contribution_id' => $contribution_id]);

    } catch (\RuntimeException $e) {
        $db->prepare('DELETE FROM gift_contributions WHERE id = ?')->execute([$contribution_id]);
        http_response_code(502);
        echo json_encode(['error' => 'Falha ao conectar com Mercado Pago.']);
    }
}

/**
 * Traduz os status_detail de rejeição do MP para mensagens amigáveis.
 */
function mp_rejection_message(string $detail): string
{
    return match ($detail) {
        'cc_rejected_insufficient_amount'      => 'Saldo insuficiente no cartão.',
        'cc_rejected_bad_filled_card_number'   => 'Número do cartão inválido.',
        'cc_rejected_bad_filled_date'          => 'Data de vencimento incorreta.',
        'cc_rejected_bad_filled_security_code' => 'CVV incorreto.',
        'cc_rejected_card_disabled'            => 'Cartão desabilitado. Contate seu banco.',
        'cc_rejected_duplicated_payment'       => 'Pagamento duplicado detectado.',
        'cc_rejected_high_risk'                => 'Pagamento recusado por segurança. Tente outro cartão.',
        default                                => 'Pagamento recusado. Verifique os dados ou tente outro cartão.',
    };
}

// ═══ HANDLERS — Autenticação / Admin ═══════════════════════════════════════════

function handle_login(PDO $db): void
{
    $body = json_input();
    $stmt = $db->prepare(
        'SELECT id, password_hash FROM couples WHERE slug = ? AND active = 1 LIMIT 1'
    );
    $stmt->execute([$body['slug'] ?? '']);
    $couple = $stmt->fetch();

    if (!$couple || !password_verify($body['password'] ?? '', $couple['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Credenciais inválidas.']);
        return;
    }

    $token = base64_encode(random_bytes(32));
    $db->prepare(
        'INSERT INTO admin_sessions (id, couple_id, token, expires_at)
         VALUES (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))'
    )->execute([$couple['id'], $token]);

    echo json_encode(['token' => $token]);
}

function handle_dashboard(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $stmt = $db->prepare('SELECT * FROM v_couple_dashboard WHERE couple_id = ? LIMIT 1');
    $stmt->execute([$couple_id]);
    echo json_encode($stmt->fetch());
}

function handle_get_rsvp(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $stmt = $db->prepare(
        'SELECT id, name, attendance, message, created_at
           FROM rsvp_responses
          WHERE couple_id = ?
          ORDER BY created_at DESC
          LIMIT 200'
    );
    $stmt->execute([$couple_id]);
    echo json_encode($stmt->fetchAll());
}

function handle_post_rsvp(PDO $db): void
{
    $couple_id = resolve_couple_by_slug($db, $_GET['couple'] ?? '');
    $body      = json_input();

    $db->prepare(
        'INSERT INTO rsvp_responses (id, couple_id, name, attendance, message)
         VALUES (UUID(), ?, ?, ?, ?)'
    )->execute([
        $couple_id,
        substr(strip_tags($body['name'] ?? ''), 0, 255),
        (int) ($body['attendance'] ?? 0),
        substr(strip_tags($body['message'] ?? ''), 0, 2000),
    ]);

    http_response_code(201);
    echo json_encode(['ok' => true]);
}

function handle_get_contributions(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $stmt = $db->prepare(
        "SELECT id, gift_item_id, gift_title, amount, contributor, payment_method, created_at
           FROM gift_contributions
          WHERE couple_id = ? AND payment_status = 'approved'
          ORDER BY created_at DESC
          LIMIT 200"
    );
    $stmt->execute([$couple_id]);
    echo json_encode($stmt->fetchAll());
}

function handle_get_gift_summary(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $stmt = $db->prepare('SELECT * FROM v_gift_summary WHERE couple_id = ?');
    $stmt->execute([$couple_id]);
    echo json_encode($stmt->fetchAll());
}

function handle_create_couple(PDO $db): void
{
    $master_key = $_SERVER['HTTP_X_MASTER_KEY'] ?? '';
    if (empty(MASTER_API_KEY) || $master_key !== MASTER_API_KEY) {
        http_response_code(403);
        echo json_encode(['error' => 'Proibido.']);
        return;
    }

    $body = json_input();
    $hash = password_hash($body['password'] ?? '', PASSWORD_BCRYPT, ['cost' => 12]);

    $db->prepare(
        'INSERT INTO couples
           (id, slug, name_partner_1, name_partner_2, wedding_date, wedding_location, pix_key, password_hash)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $body['slug'],
        $body['name_partner_1'],
        $body['name_partner_2'],
        $body['wedding_date'],
        $body['wedding_location'] ?? null,
        $body['pix_key'] ?? null,
        $hash,
    ]);

    http_response_code(201);
    echo json_encode(['ok' => true, 'slug' => $body['slug']]);
}


// ═══ HANDLERS — Admin: Rifa ════════════════════════════════════════════════════

/**
 * GET /admin/rifa
 * Retorna configuração, prêmios e bilhetes (sold + pending) com detalhes completos.
 */
function handle_admin_get_rifa(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);

    // Config
    $cfg = $db->prepare(
        'SELECT raffle_ticket_price, raffle_total_tickets, raffle_draw_threshold_pct
           FROM couples WHERE id = ? LIMIT 1'
    );
    $cfg->execute([$couple_id]);
    $config_row = $cfg->fetch();

    // Prêmios
    $prizes_stmt = $db->prepare(
        'SELECT id, title, description, display_order
           FROM raffle_prizes
          WHERE couple_id = ?
          ORDER BY display_order ASC'
    );
    $prizes_stmt->execute([$couple_id]);
    $prizes = $prizes_stmt->fetchAll();

    // Bilhetes
    $tickets_stmt = $db->prepare(
        "SELECT id, ticket_number, buyer_name, buyer_email, buyer_phone,
                payment_method, payment_status, amount, created_at
           FROM raffle_tickets
          WHERE couple_id = ? AND payment_status IN ('approved','pending')
          ORDER BY ticket_number ASC"
    );
    $tickets_stmt->execute([$couple_id]);
    $all_tickets = $tickets_stmt->fetchAll();

    $sold    = [];
    $pending = [];
    foreach ($all_tickets as $t) {
        $row = [
            'id'             => $t['id'],
            'ticket_number'  => (int) $t['ticket_number'],
            'buyer_name'     => $t['buyer_name'],
            'buyer_email'    => $t['buyer_email'],
            'buyer_phone'    => $t['buyer_phone'],
            'payment_method' => $t['payment_method'],
            'payment_status' => $t['payment_status'],
            'amount'         => (float) $t['amount'],
            'created_at'     => $t['created_at'],
        ];
        if ($t['payment_status'] === 'approved') {
            $sold[] = $row;
        } else {
            $pending[] = $row;
        }
    }

    $total = (int) $config_row['raffle_total_tickets'];
    echo json_encode([
        'config' => [
            'ticket_price'       => (float) $config_row['raffle_ticket_price'],
            'total_tickets'      => $total,
            'draw_threshold_pct' => (float) $config_row['raffle_draw_threshold_pct'],
        ],
        'prizes'  => array_map(static fn($p) => [
            'id'            => $p['id'],
            'title'         => $p['title'],
            'description'   => $p['description'] ?? '',
            'display_order' => (int) $p['display_order'],
        ], $prizes),
        'tickets' => [
            'sold'    => $sold,
            'pending' => $pending,
            'stats'   => [
                'sold'      => count($sold),
                'pending'   => count($pending),
                'available' => max(0, $total - count($sold) - count($pending)),
            ],
        ],
    ]);
}

/**
 * POST /admin/rifa/config
 * Body: { ticket_price, total_tickets, draw_threshold_pct }
 */
function handle_admin_save_rifa_config(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $body      = json_input();

    $price     = (float) ($body['ticket_price']       ?? 0);
    $total     = (int)   ($body['total_tickets']       ?? 0);
    $threshold = (float) ($body['draw_threshold_pct']  ?? 0);

    if ($price <= 0 || $total < 1 || $threshold <= 0 || $threshold > 1) {
        http_response_code(422);
        echo json_encode(['error' => 'Dados inválidos: preço > 0, bilhetes ≥ 1, threshold entre 0.01 e 1.00.']);
        return;
    }

    $db->prepare(
        'UPDATE couples
            SET raffle_ticket_price = ?, raffle_total_tickets = ?, raffle_draw_threshold_pct = ?
          WHERE id = ?'
    )->execute([$price, $total, $threshold, $couple_id]);

    echo json_encode(['ok' => true]);
}

/**
 * POST /admin/rifa/prizes
 * Body: { title, description, display_order }
 */
function handle_admin_add_prize(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $body      = json_input();

    $title       = substr(strip_tags($body['title']       ?? ''), 0, 255);
    $description = substr(strip_tags($body['description'] ?? ''), 0, 1000);
    $order       = (int) ($body['display_order'] ?? 1);

    if (empty($title)) {
        http_response_code(422);
        echo json_encode(['error' => 'Título do prêmio é obrigatório.']);
        return;
    }

    $id = generate_uuid();
    $db->prepare(
        'INSERT INTO raffle_prizes (id, couple_id, title, description, display_order)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([$id, $couple_id, $title, $description, $order]);

    http_response_code(201);
    echo json_encode([
        'ok'     => true,
        'prize'  => ['id' => $id, 'title' => $title, 'description' => $description, 'display_order' => $order],
    ]);
}

/**
 * PUT /admin/rifa/prizes/{id}
 * Body: { title, description, display_order }
 */
function handle_admin_update_prize(PDO $db, string $prize_id): void
{
    $couple_id = get_authenticated_couple_id($db);
    $body      = json_input();

    $title       = substr(strip_tags($body['title']       ?? ''), 0, 255);
    $description = substr(strip_tags($body['description'] ?? ''), 0, 1000);
    $order       = (int) ($body['display_order'] ?? 1);

    if (empty($title)) {
        http_response_code(422);
        echo json_encode(['error' => 'Título do prêmio é obrigatório.']);
        return;
    }

    $stmt = $db->prepare(
        'UPDATE raffle_prizes
            SET title = ?, description = ?, display_order = ?
          WHERE id = ? AND couple_id = ?'
    );
    $stmt->execute([$title, $description, $order, $prize_id, $couple_id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Prêmio não encontrado.']);
        return;
    }

    echo json_encode(['ok' => true]);
}

/**
 * DELETE /admin/rifa/prizes/{id}
 */
function handle_admin_delete_prize(PDO $db, string $prize_id): void
{
    $couple_id = get_authenticated_couple_id($db);

    $stmt = $db->prepare('DELETE FROM raffle_prizes WHERE id = ? AND couple_id = ?');
    $stmt->execute([$prize_id, $couple_id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Prêmio não encontrado.']);
        return;
    }

    echo json_encode(['ok' => true]);
}


// ═══ HANDLERS — Admin: Editor de Site ════════════════════════════════════════

/**
 * GET /admin/site
 */
function handle_admin_get_site(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);

    $c = $db->prepare(
        'SELECT couple_display_name, home_name, name_partner_1, name_partner_2,
                wedding_date, wedding_time, wedding_location, pix_key,
                site_intro_title, site_intro_subtitle, rooms_config
           FROM couples WHERE id = ? LIMIT 1'
    );
    $c->execute([$couple_id]);
    $row = $c->fetch();

    $gs = $db->prepare(
        'SELECT id, slug, title, subtitle, description,
                CAST(suggested_amount AS CHAR) AS suggested_amount,
                tag, tag_color, emoji_name, display_order, active
           FROM gift_items WHERE couple_id = ? ORDER BY display_order ASC'
    );
    $gs->execute([$couple_id]);

    echo json_encode([
        'couple' => [
            'display_name'     => $row['couple_display_name'] ?? '',
            'home_name'        => $row['home_name']           ?? '',
            'partner1'         => $row['name_partner_1'],
            'partner2'         => $row['name_partner_2'],
            'wedding_date'     => $row['wedding_date'],
            'wedding_time'     => $row['wedding_time'],
            'wedding_location' => $row['wedding_location']    ?? '',
            'pix_key'          => $row['pix_key']             ?? '',
        ],
        'content' => [
            'intro_title'    => $row['site_intro_title']    ?? '',
            'intro_subtitle' => $row['site_intro_subtitle'] ?? '',
        ],
        'rooms' => json_decode($row['rooms_config'] ?? '{}', true) ?: [],
        'gifts' => array_map(static fn($g) => [
            'id'               => $g['id'],
            'slug'             => $g['slug'],
            'title'            => $g['title'],
            'subtitle'         => $g['subtitle']         ?? '',
            'description'      => $g['description']      ?? '',
            'suggested_amount' => $g['suggested_amount'] !== null ? (float) $g['suggested_amount'] : null,
            'tag'              => $g['tag']              ?? '',
            'tag_color'        => $g['tag_color']        ?? '',
            'emoji_name'       => $g['emoji_name']       ?? 'gift',
            'display_order'    => (int) $g['display_order'],
            'active'           => (bool) $g['active'],
        ], $gs->fetchAll()),
    ]);
}

function handle_admin_get_gifts(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);

    $gs = $db->prepare(
        'SELECT id, slug, title, subtitle, description,
                CAST(suggested_amount AS CHAR) AS suggested_amount,
                tag, tag_color, emoji_name, display_order, active
           FROM gift_items WHERE couple_id = ? ORDER BY display_order ASC'
    );
    $gs->execute([$couple_id]);

    echo json_encode(array_map(static fn($g) => [
        'id'               => $g['id'],
        'slug'             => $g['slug'],
        'title'            => $g['title'],
        'subtitle'         => $g['subtitle']         ?? '',
        'description'      => $g['description']      ?? '',
        'suggested_amount' => $g['suggested_amount'] !== null ? (float) $g['suggested_amount'] : null,
        'tag'              => $g['tag']              ?? '',
        'tag_color'        => $g['tag_color']        ?? '',
        'emoji_name'       => $g['emoji_name']       ?? 'gift',
        'display_order'    => (int) $g['display_order'],
        'active'           => (bool) $g['active'],
    ], $gs->fetchAll()));
}

function handle_admin_save_couple(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $b = json_input();

    $wedding_date = $b['wedding_date'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $wedding_date)) {
        http_response_code(422);
        echo json_encode(['error' => 'Data inválida (use YYYY-MM-DD).']);
        return;
    }

    $db->prepare(
        'UPDATE couples
            SET couple_display_name=?, home_name=?,
                name_partner_1=?, name_partner_2=?,
                wedding_date=?, wedding_time=?,
                wedding_location=?, pix_key=?
          WHERE id=?'
    )->execute([
        substr(strip_tags($b['display_name']     ?? ''), 0, 255),
        substr(strip_tags($b['home_name']        ?? ''), 0, 100),
        substr(strip_tags($b['partner1']         ?? ''), 0, 255),
        substr(strip_tags($b['partner2']         ?? ''), 0, 255),
        $wedding_date,
        substr(preg_replace('/[^0-9:]/', '', $b['wedding_time'] ?? ''), 0, 5),
        substr(strip_tags($b['wedding_location'] ?? ''), 0, 255),
        substr(strip_tags($b['pix_key']          ?? ''), 0, 255) ?: null,
        $couple_id,
    ]);

    echo json_encode(['ok' => true]);
}

function handle_admin_save_content(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $b = json_input();

    $db->prepare(
        'UPDATE couples SET site_intro_title=?, site_intro_subtitle=? WHERE id=?'
    )->execute([
        substr(strip_tags($b['intro_title']    ?? ''), 0, 255),
        substr(strip_tags($b['intro_subtitle'] ?? ''), 0, 2000),
        $couple_id,
    ]);

    echo json_encode(['ok' => true]);
}

function handle_admin_save_rooms(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    $rooms_raw = (json_input())['rooms'] ?? [];
    $clean = [];

    foreach (['entrada', 'sala', 'escritorio', 'varanda'] as $key) {
        if (!isset($rooms_raw[$key])) continue;
        $r = $rooms_raw[$key];
        $entry = [
            'title' => substr(strip_tags($r['title'] ?? ''), 0, 255),
            'desc'  => substr(strip_tags($r['desc']  ?? ''), 0, 2000),
        ];
        if (!empty($r['nextText'])) {
            $entry['nextText'] = substr(strip_tags($r['nextText']), 0, 100);
        }
        $clean[$key] = $entry;
    }

    $db->prepare('UPDATE couples SET rooms_config=? WHERE id=?')
       ->execute([json_encode($clean, JSON_UNESCAPED_UNICODE), $couple_id]);

    echo json_encode(['ok' => true]);
}

function handle_admin_add_gift(PDO $db): void
{
    $couple_id = get_authenticated_couple_id($db);
    [$id, $err] = admin_gift_upsert($db, $couple_id, null, json_input());
    if ($err) { http_response_code(422); echo json_encode(['error' => $err]); return; }
    http_response_code(201);
    echo json_encode(['ok' => true, 'id' => $id]);
}

function handle_admin_update_gift(PDO $db, string $gift_id): void
{
    $couple_id = get_authenticated_couple_id($db);
    [, $err] = admin_gift_upsert($db, $couple_id, $gift_id, json_input());
    if ($err) { http_response_code(422); echo json_encode(['error' => $err]); return; }
    echo json_encode(['ok' => true]);
}

function handle_admin_delete_gift(PDO $db, string $gift_id): void
{
    $couple_id = get_authenticated_couple_id($db);
    $stmt = $db->prepare('UPDATE gift_items SET active=0 WHERE id=? AND couple_id=?');
    $stmt->execute([$gift_id, $couple_id]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Presente não encontrado.']);
        return;
    }
    echo json_encode(['ok' => true]);
}

function admin_gift_upsert(PDO $db, string $couple_id, ?string $gift_id, array $b): array
{
    $slug  = substr(preg_replace('/[^a-z0-9\-]/', '', strtolower($b['slug']  ?? '')), 0, 50);
    $title = substr(strip_tags($b['title'] ?? ''), 0, 255);
    if (empty($slug) || empty($title)) return [null, 'Slug e título são obrigatórios.'];

    $amount = (isset($b['suggested_amount']) && $b['suggested_amount'] !== null && $b['suggested_amount'] !== '')
              ? (float) $b['suggested_amount'] : null;

    $row = [
        substr(strip_tags($b['subtitle']    ?? ''), 0, 255),
        substr(strip_tags($b['description'] ?? ''), 0, 5000),
        $amount,
        substr(strip_tags($b['tag']        ?? ''), 0, 100),
        substr(strip_tags($b['tag_color']  ?? ''), 0, 100),
        substr(strip_tags($b['emoji_name'] ?? 'gift'), 0, 50),
        (int) ($b['display_order'] ?? 0),
        isset($b['active']) ? (int) $b['active'] : 1,
    ];

    if ($gift_id === null) {
        $gift_id = generate_uuid();
        $db->prepare(
            'INSERT INTO gift_items
               (id, couple_id, slug, title, subtitle, description, suggested_amount,
                tag, tag_color, emoji_name, display_order, active)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        )->execute(array_merge([$gift_id, $couple_id, $slug, $title], $row));
    } else {
        $stmt = $db->prepare(
            'UPDATE gift_items
                SET slug=?,title=?,subtitle=?,description=?,suggested_amount=?,
                    tag=?,tag_color=?,emoji_name=?,display_order=?,active=?
              WHERE id=? AND couple_id=?'
        );
        $stmt->execute(array_merge([$slug, $title], $row, [$gift_id, $couple_id]));
        if ($stmt->rowCount() === 0) return [null, 'Presente não encontrado.'];
    }

    return [$gift_id, null];
}
