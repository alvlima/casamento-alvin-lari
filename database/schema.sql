-- =============================================================================
-- casamentos — Schema MySQL multi-tenant
-- Banco: alvar028_casamentos
-- Versão: 2.0.0 — MySQL 8.0+ recomendado (mínimo 5.7)
-- Importar via: phpMyAdmin > aba SQL > colar e executar
-- =============================================================================
-- NOTAS DE COMPATIBILIDADE MySQL 5.7:
--   • DEFAULT (UUID()) não existe — UUID gerado pela aplicação (PHP/backend)
--   • CHECK constraints são ignoradas — validar no PHP
--   • CREATE OR REPLACE VIEW não existe — usar DROP + CREATE
--   • CREATE PROCEDURE IF NOT EXISTS não existe — usar DROP IF EXISTS + CREATE
--   • str_starts_with() é PHP 8.0+ — o backend PHP requer PHP >= 8.0
--   • match() expression é PHP 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. CASAIS (tenants)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.couples (
  id                        CHAR(36)              NOT NULL,
  slug                      VARCHAR(100)          NOT NULL,
  name_partner_1            VARCHAR(255)          NOT NULL,
  name_partner_2            VARCHAR(255)          NOT NULL,
  wedding_date              DATE                  NOT NULL,
  wedding_time              VARCHAR(5)            NOT NULL DEFAULT '16:00',
  wedding_location          VARCHAR(255),
  pix_key                   VARCHAR(255),
  password_hash             VARCHAR(255)          NOT NULL,
  raffle_ticket_price       DECIMAL(8,2) UNSIGNED NOT NULL DEFAULT 18.00,
  raffle_total_tickets      SMALLINT UNSIGNED     NOT NULL DEFAULT 200,
  raffle_draw_threshold_pct DECIMAL(4,3) UNSIGNED NOT NULL DEFAULT 0.950,
  couple_display_name  VARCHAR(255) NOT NULL DEFAULT '',
  home_name            VARCHAR(100) NOT NULL DEFAULT '',
  site_intro_title     VARCHAR(255) NOT NULL DEFAULT '',
  site_intro_subtitle  TEXT,
  rooms_config         JSON,
  active                    TINYINT(1)            NOT NULL DEFAULT 1,
  created_at                DATETIME              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME              NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_slug    (slug),
  INDEX        idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. SESSÕES ADMIN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.admin_sessions (
  id          CHAR(36)     NOT NULL,
  couple_id   CHAR(36)     NOT NULL,
  token       VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_token           (token),
  INDEX       idx_couple_expires (couple_id, expires_at),
  FOREIGN KEY (couple_id) REFERENCES alvar028_casamentos.couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. CONFIRMAÇÕES DE PRESENÇA (RSVP)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.rsvp_responses (
  id          CHAR(36)     NOT NULL,
  couple_id   CHAR(36)     NOT NULL,
  name        VARCHAR(255) NOT NULL,
  attendance  TINYINT(1)   NOT NULL,
  message     TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_attendance (couple_id, attendance),
  INDEX idx_couple_created    (couple_id, created_at),
  FOREIGN KEY (couple_id) REFERENCES alvar028_casamentos.couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. ITENS DA LISTA DE PRESENTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.gift_items (
  id               CHAR(36)      NOT NULL,
  couple_id        CHAR(36)      NOT NULL,
  slug             VARCHAR(50)   NOT NULL,
  title            VARCHAR(255)  NOT NULL,
  subtitle         VARCHAR(255),
  description      TEXT,
  suggested_amount DECIMAL(10,2) UNSIGNED,
  tag              VARCHAR(100),
  tag_color        VARCHAR(100),
  emoji_name       VARCHAR(50),
  display_order    SMALLINT      NOT NULL DEFAULT 0,
  active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_couple_slug   (couple_id, slug),
  INDEX       idx_couple_order (couple_id, display_order, active),
  FOREIGN KEY (couple_id) REFERENCES alvar028_casamentos.couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. CONTRIBUIÇÕES DE PRESENTES
--    payment_method: 'pix_manual' = Pix estático (legado) | 'pix' | 'credit_card'
--    payment_status: pending → approved (webhook MP) | rejected
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.gift_contributions (
  id                CHAR(36)                                NOT NULL,
  couple_id         CHAR(36)                                NOT NULL,
  gift_item_id      CHAR(36),
  gift_title        VARCHAR(255)                            NOT NULL,
  amount            DECIMAL(10,2)                           NOT NULL,
  contributor       VARCHAR(255),
  contributor_email VARCHAR(255),
  payment_method    ENUM('pix_manual','pix','credit_card')  NOT NULL DEFAULT 'pix_manual',
  payment_status    ENUM('pending','approved','rejected')   NOT NULL DEFAULT 'approved',
  mp_payment_id     VARCHAR(255),
  mp_preference_id  VARCHAR(255),
  created_at        DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_item     (couple_id, gift_item_id),
  INDEX idx_couple_status   (couple_id, payment_status),
  INDEX idx_couple_created  (couple_id, created_at),
  INDEX idx_couple_amount   (couple_id, amount),
  INDEX idx_mp_payment      (mp_payment_id),
  FOREIGN KEY (couple_id)    REFERENCES alvar028_casamentos.couples(id)    ON DELETE CASCADE,
  FOREIGN KEY (gift_item_id) REFERENCES alvar028_casamentos.gift_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. BILHETES DE RIFA
--    Cada bilhete tem reserva temporária (expires_at = +30min) enquanto pending.
--    Só um bilhete approved ou pending (não expirado) pode existir por número.
--    O isolamento de tenant é garantido por couple_id em toda query.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.raffle_tickets (
  id               CHAR(36)                                              NOT NULL,
  couple_id        CHAR(36)                                              NOT NULL,
  ticket_number    SMALLINT UNSIGNED                                     NOT NULL,
  buyer_name       VARCHAR(255),
  buyer_email      VARCHAR(255)                                          NOT NULL,
  buyer_phone      VARCHAR(50),
  payment_method   ENUM('pix','credit_card')                             NOT NULL,
  payment_status   ENUM('pending','approved','rejected','cancelled')     NOT NULL DEFAULT 'pending',
  mp_payment_id    VARCHAR(255),
  mp_preference_id VARCHAR(255),
  amount           DECIMAL(10,2)                                         NOT NULL,
  expires_at       DATETIME,                               -- reserva expira em 30 min
  created_at       DATETIME                                              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME                                              NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_status  (couple_id, payment_status),
  INDEX idx_couple_ticket  (couple_id, ticket_number),
  INDEX idx_mp_payment     (mp_payment_id),
  INDEX idx_expires        (expires_at),
  FOREIGN KEY (couple_id) REFERENCES alvar028_casamentos.couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. PRÊMIOS DA RIFA
--    Ordem definida por display_order (1 = 1º lugar, 2 = 2º, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alvar028_casamentos.raffle_prizes (
  id            CHAR(36)     NOT NULL,
  couple_id     CHAR(36)     NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  display_order TINYINT      NOT NULL DEFAULT 1,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_order (couple_id, display_order, active),
  FOREIGN KEY (couple_id) REFERENCES alvar028_casamentos.couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- VIEWS
-- =============================================================================

DROP VIEW IF EXISTS alvar028_casamentos.v_rsvp_summary;
CREATE VIEW alvar028_casamentos.v_rsvp_summary AS
  SELECT
    couple_id,
    COUNT(*)          AS total_responses,
    SUM(attendance)   AS confirmed,
    SUM(1-attendance) AS declined,
    MAX(created_at)   AS last_response_at
  FROM alvar028_casamentos.rsvp_responses
  GROUP BY couple_id;

-- Apenas contribuições aprovadas entram na contabilidade
DROP VIEW IF EXISTS alvar028_casamentos.v_gift_summary;
CREATE VIEW alvar028_casamentos.v_gift_summary AS
  SELECT
    couple_id,
    gift_item_id,
    gift_title,
    COUNT(*)    AS contribution_count,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount
  FROM alvar028_casamentos.gift_contributions
  WHERE payment_status = 'approved'
  GROUP BY couple_id, gift_item_id, gift_title;

DROP VIEW IF EXISTS alvar028_casamentos.v_couple_dashboard;
CREATE VIEW alvar028_casamentos.v_couple_dashboard AS
  SELECT
    c.id                                                                           AS couple_id,
    c.slug,
    c.name_partner_1,
    c.name_partner_2,
    c.wedding_date,
    COALESCE(r.total_responses, 0)                                                 AS total_rsvp,
    COALESCE(r.confirmed, 0)                                                       AS confirmed,
    COALESCE(r.declined, 0)                                                        AS declined,
    COALESCE(SUM(CASE WHEN gc.payment_status = 'approved' THEN gc.amount ELSE 0 END), 0) AS total_gift_amount,
    COUNT(DISTINCT CASE WHEN gc.payment_status = 'approved' THEN gc.id END)        AS total_contributions
  FROM alvar028_casamentos.couples c
  LEFT JOIN alvar028_casamentos.v_rsvp_summary      r  ON r.couple_id = c.id
  LEFT JOIN alvar028_casamentos.gift_contributions  gc ON gc.couple_id = c.id
  WHERE c.active = 1
  GROUP BY c.id, c.slug, c.name_partner_1, c.name_partner_2,
           c.wedding_date, r.total_responses, r.confirmed, r.declined;

-- Resumo da rifa por casal
DROP VIEW IF EXISTS alvar028_casamentos.v_raffle_summary;
CREATE VIEW alvar028_casamentos.v_raffle_summary AS
  SELECT
    couple_id,
    COUNT(CASE WHEN payment_status = 'approved' THEN 1 END)                                                     AS tickets_sold,
    COUNT(CASE WHEN payment_status = 'pending' AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END)       AS tickets_pending,
    SUM(CASE WHEN payment_status = 'approved' THEN amount ELSE 0 END)                                           AS total_arrecadado
  FROM alvar028_casamentos.raffle_tickets
  GROUP BY couple_id;

-- =============================================================================
-- STORED PROCEDURES
-- =============================================================================

DROP PROCEDURE IF EXISTS alvar028_casamentos.sp_cleanup_sessions;
DELIMITER $$
CREATE PROCEDURE alvar028_casamentos.sp_cleanup_sessions()
BEGIN
  DELETE FROM alvar028_casamentos.admin_sessions WHERE expires_at < NOW();
  DELETE FROM alvar028_casamentos.raffle_tickets  WHERE payment_status = 'pending' AND expires_at < NOW();
END$$
DELIMITER ;

-- =============================================================================
-- DADOS INICIAIS — Casal Alvin & Lari
-- Senha padrão: alvinelari2026
-- Gerar hash no PHP: echo password_hash('alvinelari2026', PASSWORD_BCRYPT, ['cost' => 12]);
-- =============================================================================

-- Casal
INSERT IGNORE INTO alvar028_casamentos.couples
  (id, slug, name_partner_1, name_partner_2, wedding_date, wedding_time,
   wedding_location, pix_key, password_hash,
   raffle_ticket_price, raffle_total_tickets, raffle_draw_threshold_pct,
   couple_display_name, home_name, site_intro_title, site_intro_subtitle, rooms_config)
VALUES (
  'a1b2c3d4-e5f6-4789-abcd-000000000001',
  'alvin-lari',
  'Álvaro',
  'Larissa',
  '2026-07-18',
  '16:00',
  'Mogi das Cruzes, SP',
  'alvaro.soares01@hotmail.com',
  '$2a$12$ZV1O2uKGAA/k39yVjCMqe.an9C0rZ1zBSxdOQP1k5gfbw7CwJ8Cge',
  18.00,
  200,
  0.950,
  'Álvaro & Larissa',
  'AP Patinhas',
  'Um Convite | fora dos Dados.',
  'Projetamos cada detalhe do nosso lar. Agora, convidamos você para caminhar por ele antes do altar.',
  '{"entrada":{"title":"O Portal","desc":"Você está diante da porta do AP Patinhas. Este é o início da nossa vida juntos. Para entrar, você deve estar disposto a compartilhar da nossa paz.","nextText":"Girar a Chave e Entrar"},"sala":{"title":"A Sala de Estar e Jantar","desc":"Um espaço de aconchego onde o místico e o lógico se encontram. O Elo de Afeto está escondido aqui — procure pelos nossos gatinhos.","nextText":"Seguir para os Escritórios"},"escritorio":{"title":"O Hub de Dualidade","desc":"De um lado, a introspecção e a alma da Larissa. Do outro, a mente veloz e os dados do Álvaro. Alinhe os dois mundos para seguir adiante.","nextText":"Ir para a Varanda"},"varanda":{"title":"O Altar da Varanda","desc":"Nosso quintal, nossa rede, nosso sim. Se você trouxe as chaves do Afeto, da Intuição e da Lógica, o caminho para o nosso altar está aberto."}}'
);

-- Presentes (gift_items)
-- Remover e reinserir para garantir dados atualizados
DELETE FROM alvar028_casamentos.gift_items WHERE couple_id = 'a1b2c3d4-e5f6-4789-abcd-000000000001';

INSERT INTO alvar028_casamentos.gift_items
  (id, couple_id, slug, title, subtitle, description, suggested_amount, tag, tag_color, emoji_name, display_order)
VALUES
  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'cafe',
   'A Cafeteira Sagrada', 'O Ritual da Manhã',
   'Nosso dia começa com um café junto. Ajude a tornar esse momento ainda mais especial.',
   300.00, 'Essencial', 'bg-amber-100 text-amber-700', 'coffee', 1),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'lua',
   'Lua de Mel em Modo Avião', 'Nossa Primeira Grande Aventura',
   'Qualquer valor ajuda a escrever esse capítulo da nossa história.',
   500.00, 'Sonho', 'bg-sky-100 text-sky-700', 'plane', 2),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'gatos',
   'Ração dos Guardiões do AP', 'Para o Milu e o Pixel',
   'Nossos gatinhos são parte da família. Eles agradecem qualquer contribuição.',
   80.00, 'Fofura', 'bg-purple-100 text-purple-700', 'cat', 3),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'vinho',
   'O Ritual da Primeira Noite', 'Vinho & Quitutes',
   'Uma seleção especial de vinhos e petiscos para celebrar nossa primeira noite como casados.',
   150.00, 'Celebração', 'bg-rose-100 text-rose-700', 'wine', 4),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'planta',
   'A Primeira Planta da Varanda', 'Nosso Jardim Secreto',
   'Queremos transformar nossa varanda num oásis verde. Cada plantinha é um passo nessa direção.',
   90.00, 'Lar', 'bg-green-100 text-green-700', 'plant', 5),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'terapia',
   'Sessão de Alinhamento do Casal', 'Terapia & Bem-Estar',
   'Investir na saúde mental é o presente mais duradouro que podemos dar um ao outro.',
   200.00, 'Bem-estar', 'bg-teal-100 text-teal-700', 'heart', 6),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'pizza',
   'O Primeiro Delivery do Endereço', 'A Tradição da Sexta',
   'Nossa tradição de pizza na sexta-feira merece um upgrade. Ajude a tornar essa noite especial.',
   100.00, 'Tradição', 'bg-orange-100 text-orange-700', 'pizza', 7),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'livros',
   'A Estante dos Dois Mundos', 'Nossa Biblioteca Compartilhada',
   'Ele ama ficção científica, ela ama desenvolvimento pessoal. Uma estante que une os dois universos.',
   120.00, 'Cultura', 'bg-indigo-100 text-indigo-700', 'book', 8),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'games',
   'Noite de Board Games', 'O Tabuleiro do Amor',
   'Jogos de tabuleiro para as noites frias em casa. Competição saudável e muitas risadas.',
   130.00, 'Diversão', 'bg-violet-100 text-violet-700', 'gamepad', 9),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'spa',
   'Dia de Spa do Casal', 'Descompressão Total',
   'Uma experiência de spa para dois após o agito do casamento. Merecemos!',
   350.00, 'Luxo', 'bg-pink-100 text-pink-700', 'sparkles', 10),

  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001', 'livre',
   'Contribuição Livre', 'O Presente Perfeito',
   'Contribua com qualquer valor. Cada real vai direto para construir nossa nova vida juntos.',
   NULL, 'Livre', 'bg-slate-100 text-slate-600', 'gift', 11);

-- Prêmios da Rifa
DELETE FROM alvar028_casamentos.raffle_prizes WHERE couple_id = 'a1b2c3d4-e5f6-4789-abcd-000000000001';

INSERT INTO alvar028_casamentos.raffle_prizes (id, couple_id, title, description, display_order)
VALUES
  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001',
   '🥇 Experiência Gastronômica',
   'Jantar para 2 em restaurante premiado de São Paulo + transporte.',
   1),
  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001',
   '🥈 Kit Bem-Estar',
   'Spa day completo para 1 pessoa + kit de aromaterapia artesanal.',
   2),
  (UUID(), 'a1b2c3d4-e5f6-4789-abcd-000000000001',
   '🥉 Cesta Gourmet',
   'Seleção especial de vinhos, queijos e azeites importados.',
   3);

SET FOREIGN_KEY_CHECKS = 1;
