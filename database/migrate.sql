-- =============================================================================
-- migrate.sql — Migração segura para atualizar banco existente
-- Rodar no phpMyAdmin > aba SQL > colar tudo e executar
-- Seguro para rodar múltiplas vezes (idempotente via IF NOT EXISTS)
-- =============================================================================

SET NAMES utf8mb4;
USE alvar028_casamentos;

-- -----------------------------------------------------------------------------
-- 1. Adiciona colunas novas em couples (se ainda não existirem)
-- -----------------------------------------------------------------------------

-- Horário do casamento
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS wedding_time VARCHAR(5) NOT NULL DEFAULT '16:00';

-- Config da rifa
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS raffle_ticket_price       DECIMAL(8,2) UNSIGNED NOT NULL DEFAULT 18.00;
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS raffle_total_tickets      SMALLINT UNSIGNED     NOT NULL DEFAULT 200;
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS raffle_draw_threshold_pct DECIMAL(4,3) UNSIGNED NOT NULL DEFAULT 0.950;

-- Dados do site editável
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS couple_display_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS home_name           VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS site_intro_title    VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS site_intro_subtitle TEXT;
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS rooms_config        JSON;

-- updated_at (se não existir)
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 2. Cria tabelas novas (rifa) se não existirem
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS raffle_tickets (
  id               CHAR(36)                                          NOT NULL,
  couple_id        CHAR(36)                                          NOT NULL,
  ticket_number    SMALLINT UNSIGNED                                 NOT NULL,
  buyer_name       VARCHAR(255),
  buyer_email      VARCHAR(255)                                      NOT NULL,
  buyer_phone      VARCHAR(50),
  payment_method   ENUM('pix','credit_card')                         NOT NULL,
  payment_status   ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  mp_payment_id    VARCHAR(255),
  mp_preference_id VARCHAR(255),
  amount           DECIMAL(10,2)                                     NOT NULL,
  expires_at       DATETIME,
  created_at       DATETIME                                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME                                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_status (couple_id, payment_status),
  INDEX idx_couple_ticket (couple_id, ticket_number),
  INDEX idx_mp_payment    (mp_payment_id),
  INDEX idx_expires       (expires_at),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS raffle_prizes (
  id            CHAR(36)     NOT NULL,
  couple_id     CHAR(36)     NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  display_order TINYINT      NOT NULL DEFAULT 1,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_couple_order (couple_id, display_order, active),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Atualiza dados do casal Alvin & Lari com as novas colunas
--    (preenche os valores que ficaram em DEFAULT vazio)
-- -----------------------------------------------------------------------------

UPDATE couples
   SET couple_display_name  = 'Larissa & Alvaro',
       home_name            = 'AP Patinhas',
       site_intro_title     = 'Um Convite | fora dos Dados.',
       site_intro_subtitle  = 'Projetamos cada detalhe do nosso lar. Agora, convidamos você para caminhar por ele antes do altar.',
       wedding_time         = '16:00',
       rooms_config         = '{"entrada":{"title":"O Portal","desc":"Você está diante da porta do AP Patinhas.","nextText":"Girar a Chave e Entrar"},"sala":{"title":"A Sala de Estar e Jantar","desc":"Um espaço de aconchego onde o místico e o lógico se encontram.","nextText":"Seguir para os Escritórios"},"escritorio":{"title":"O Hub de Dualidade","desc":"De um lado, a introspecção da Larissa. Do outro, a mente veloz do Alvaro.","nextText":"Ir para a Varanda"},"varanda":{"title":"O Altar da Varanda","desc":"Nosso quintal, nossa rede, nosso sim."}}'
 WHERE slug = 'alvin-lari'
   AND (couple_display_name = '' OR couple_display_name IS NULL);

-- -----------------------------------------------------------------------------
-- 4. Recria views (DROP + CREATE para garantir estrutura atualizada)
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS v_raffle_summary;
CREATE VIEW v_raffle_summary AS
  SELECT
    couple_id,
    COUNT(CASE WHEN payment_status = 'approved' THEN 1 END) AS tickets_sold,
    COUNT(CASE WHEN payment_status = 'pending'
               AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END) AS tickets_pending,
    SUM(CASE WHEN payment_status = 'approved' THEN amount ELSE 0 END) AS total_arrecadado
  FROM raffle_tickets
  GROUP BY couple_id;

-- Fim da migração
SELECT 'Migração concluída com sucesso!' AS status;
