/**
 * weddingConfig.ts — Configurações do casamento carregadas do banco de dados
 *
 * Endpoint: GET /api/config?couple=alvin-lari
 * Retorna:  dados do casal, conteúdo do site, cômodos, config da rifa + prêmios, catálogo de presentes.
 *
 * IS_MOCK = true quando VITE_API_BASE_URL não está configurado.
 * O resultado é cacheado em memória por toda a sessão (invalidateWeddingConfigCache
 * pode ser chamado pelo painel admin após edições).
 */

const API     = import.meta.env.VITE_API_BASE_URL ?? '';
const COUPLE  = 'alvin-lari';
const IS_MOCK = !API;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CoupleConfig {
  name:             string;   // "Larissa & Alvaro"
  home_name:        string;   // "AP Patinhas"
  partner1:         string;   // "Alvaro"
  partner2:         string;   // "Larissa"
  wedding_date:     string;   // ISO: "2026-08-01"
  wedding_location: string;   // "Mogi das Cruzes, SP"
  wedding_time:     string;   // "16:00"
}

export interface SiteContent {
  intro_title:    string;   // "Um Convite | fora dos Dados."
  intro_subtitle: string;   // parágrafo de intro
}

export interface RoomContent {
  title:     string;
  desc:      string;
  nextText?: string;
}

export interface RafflePrize {
  position:    number;
  title:       string;
  description: string;
}

export interface RaffleConfig {
  ticket_price:       number;
  total_tickets:      number;
  draw_threshold_pct: number;
  prizes:             RafflePrize[];
}

export interface GiftCatalogItem {
  id:               string;
  slug:             string;
  title:            string;
  subtitle:         string;
  description:      string;
  suggested_amount: number | null;
  tag:              string;
  tag_color:        string;   // classes Tailwind
  emoji_name:       string;   // nome do ícone Lucide
}

export interface WeddingConfig {
  couple: CoupleConfig;
  site:   SiteContent;
  rooms:  Record<string, RoomContent>;
  raffle: RaffleConfig;
  gifts:  GiftCatalogItem[];
}

// ── Mock (dev sem backend) ────────────────────────────────────────────────────

const MOCK_CONFIG: WeddingConfig = {
  couple: {
    name:             'Larissa & Alvaro',
    home_name:        'AP Patinhas',
    partner1:         'Alvaro',
    partner2:         'Larissa',
    wedding_date:     '2026-08-01',
    wedding_location: 'Mogi das Cruzes, SP',
    wedding_time:     '16:00',
  },
  site: {
    intro_title:    'Um Convite | fora dos Dados.',
    intro_subtitle: 'Projetamos cada detalhe do nosso lar. Agora, convidamos você para caminhar por ele antes do altar.',
  },
  rooms: {
    entrada: {
      title:    'O Portal',
      desc:     'Você está diante da porta do AP Patinhas. Este é o início da nossa vida juntos. Para entrar, você deve estar disposto a compartilhar da nossa paz.',
      nextText: 'Girar a Chave e Entrar',
    },
    sala: {
      title:    'A Sala de Estar e Jantar',
      desc:     'Um espaço de aconchego onde o místico e o lógico se encontram. O Elo de Afeto está escondido aqui — procure pelos nossos gatinhos.',
      nextText: 'Seguir para os Escritórios',
    },
    escritorio: {
      title:    'O Hub de Dualidade',
      desc:     'De um lado, a introspecção e a alma da Larissa. Do outro, a mente veloz e os dados do Alvaro. Alinhe os dois mundos para seguir adiante.',
      nextText: 'Ir para a Varanda',
    },
    varanda: {
      title: 'O Altar da Varanda',
      desc:  'Nosso quintal, nossa rede, nosso sim. Se você trouxe as chaves do Afeto, da Intuição e da Lógica, o caminho para o nosso altar está aberto.',
    },
  },
  raffle: {
    ticket_price:       18,
    total_tickets:      200,
    draw_threshold_pct: 0.95,
    prizes: [
      { position: 1, title: '🥇 Experiência Gastronômica', description: 'Jantar para 2 em restaurante premiado de São Paulo + transporte.' },
      { position: 2, title: '🥈 Kit Bem-Estar',            description: 'Spa day completo para 1 pessoa + kit de aromaterapia artesanal.' },
      { position: 3, title: '🥉 Cesta Gourmet',            description: 'Seleção especial de vinhos, queijos e azeites importados.' },
    ],
  },
  gifts: [
    { id:'gatos',    slug:'gatos',    emoji_name:'cat',       title:'Ração dos Guardiões do AP',         subtitle:'Frida & Alvin agradecem',          description:'Garanta que os felinos-chefes do AP Patinhas não passem fome enquanto os donos estão em lua de mel.',                                            suggested_amount:50,  tag:'Missão Urgente',        tag_color:'bg-orange-100 text-orange-600' },
    { id:'planta',   slug:'planta',   emoji_name:'leaf',      title:'A Primeira Planta da Varanda',      subtitle:'Missão: folhagem viva',             description:'Uma planta resistente (porque somos otimistas) para inaugurar o cantinho verde onde a rede vai balançar.',                                      suggested_amount:80,  tag:'AP Patinhas',           tag_color:'bg-green-100 text-green-700'  },
    { id:'vinho',    slug:'vinho',    emoji_name:'wine',      title:'O Ritual da Primeira Noite',        subtitle:'A garrafa do novo lar',             description:'Um vinho guardado para o momento exato em que a chave girar pela primeira vez no AP. Destelhado com cerimônia.',                               suggested_amount:120, tag:'Ritual Sagrado',        tag_color:'bg-purple-100 text-purple-600'},
    { id:'pizza',    slug:'pizza',    emoji_name:'pizza',     title:'O Primeiro Delivery do Endereço',   subtitle:'Inauguração oficial',              description:'A pizza que vai cadastrar o novo CEP em todos os apps. Um marco civilizatório para qualquer lar.',                                               suggested_amount:90,  tag:'Missão Crítica',        tag_color:'bg-red-100 text-red-600'      },
    { id:'cafe',     slug:'cafe',     emoji_name:'coffee',    title:'A Cafeteira Sagrada',               subtitle:'O Alvaro não funciona sem ela',     description:'Confirmado pela Larissa após anos de pesquisa de campo: sem café, o sistema não inicializa. Invista na infraestrutura.',                      suggested_amount:200, tag:'Infraestrutura',        tag_color:'bg-yellow-100 text-yellow-700'},
    { id:'livro',    slug:'livro',    emoji_name:'book-open', title:'Enciclopédia Junguiana de Bolso',   subtitle:'Para debates filosóficos às 23h',   description:'Para os momentos em que a Lari precisar de embasamento científico durante uma discussão sobre qual série assistir.',                         suggested_amount:75,  tag:'Arma Intelectual',      tag_color:'bg-indigo-100 text-indigo-600'},
    { id:'musica',   slug:'musica',   emoji_name:'music-2',   title:'A Playlist Eterna do AP',           subtitle:'A trilha sonora oficial',           description:'Assine um ano de música premium para que cada cômodo do AP Patinhas tenha a vibe certa na hora certa.',                                       suggested_amount:150, tag:'Experiência',           tag_color:'bg-pink-100 text-pink-600'    },
    { id:'terapia',  slug:'terapia',  emoji_name:'sparkles',  title:'Sessão de Alinhamento do Casal',    subtitle:'Quando lógica vs. intuição travar', description:'Uma sessão de terapia para o dia em que os dois mundos precisarem de um mediador neutro e qualificado.',                                     suggested_amount:180, tag:'Manutenção Preventiva', tag_color:'bg-violet-100 text-violet-600'},
    { id:'academia', slug:'academia', emoji_name:'dumbbell',  title:'Treino dos Noivos',                 subtitle:'Energia para a dança',              description:'Um mês de academia para os dois. Para chegar na pista de dança com fôlego suficiente para aguentar a festa toda.',                           suggested_amount:160, tag:'Upgrade Físico',        tag_color:'bg-teal-100 text-teal-700'   },
    { id:'lua',      slug:'lua',      emoji_name:'plane',     title:'Lua de Mel em Modo Avião',          subtitle:'Cada real é um trecho da viagem',   description:'A viagem mais esperada do algoritmo de amor. Qualquer contribuição vira passagem, hospedagem ou uma sobremesa ridiculamente cara.',         suggested_amount:500, tag:'Boss Final',            tag_color:'bg-sky-100 text-sky-700'     },
    { id:'almofada', slug:'almofada', emoji_name:'heart',     title:'Almofada Extra do Sofá',            subtitle:'Para o impasse de lados',           description:'Uma almofada neutra para mediar o debate definitivo sobre qual lado do sofá pertence a quem. A diplomacia tem custo.',                        suggested_amount:60,  tag:'Diplomacia',            tag_color:'bg-rose-100 text-rose-600'   },
  ],
};

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cache: WeddingConfig | null = null;

export async function fetchWeddingConfig(): Promise<WeddingConfig> {
  if (_cache) return _cache;
  if (IS_MOCK) {
    await tick();
    _cache = MOCK_CONFIG;
    return MOCK_CONFIG;
  }
  const res = await fetch(`${API}/config?couple=${COUPLE}`);
  if (!res.ok) throw new Error('Falha ao carregar configurações do casamento.');
  _cache = await res.json() as WeddingConfig;
  return _cache;
}

/** Invalida o cache local — chamar após edições no painel admin. */
export function invalidateWeddingConfigCache(): void {
  _cache = null;
}

// ── Util ─────────────────────────────────────────────────────────────────────

/** Formata "2026-08-01" → "01 de Agosto de 2026" */
export function formatWeddingDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d} de ${months[m - 1]} de ${y}`;
}

const tick = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms));
