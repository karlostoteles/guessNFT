# El Circuito Noir de WhoisWho — Guía Completa en Español

## Glosario de Variables

| Variable en código | Nombre en español | ¿Qué es? |
|---|---|---|
| `game_id` | **ID de partida** | Identificador único de la sesión de juego |
| `turn_id` | **ID de turno** | Número de ronda actual (anti-replay) |
| `player` | **jugador** | Tu dirección de wallet en Starknet |
| `commitment` | **compromiso** | El hash que publicaste al inicio del juego |
| `question_id` | **ID de pregunta** | Qué rasgo se está preguntando (0-417) |
| `traits_root` | **raíz de rasgos** | La firma oficial de toda la colección Schizodio |
| `character_id` | **ID de personaje** | Cuál de los 999 NFTs elegiste (secreto) |
| `salt` | **sal** | Número aleatorio para que nadie adivine tu personaje |
| `trait_bitmap` | **mapa de bits de rasgos** | Lista de todos tus rasgos en formato binario |
| `merkle_path` | **ruta Merkle** | Los 10 hashes para subir hasta la raíz del árbol |
| `answer_bit` | **bit de respuesta** | La respuesta: 1 = SÍ, 0 = NO |
| `leaf` | **hoja** | El hash único que representa a tu personaje en el árbol |

---

## La Gran Analogía: El Sobre Sellado y el Árbol de Registros

> Imaginate que WhoisWho se juega por correo certificado en el siglo pasado.
>
> **Al inicio de la partida:** Agarrás tu carta NFT (Schizodio #41), la metés en un sobre, lo sellás con cera lacrada y lo mandás al árbitro (la blockchain). El sello tiene estampado el código `hash4(partida, tu_wallet, #41, sal_aleatoria)`. El árbitro guarda ese sello pero jamás abre el sobre.
>
> **Cuando te preguntan algo:** El rival pregunta "¿tu personaje tiene ojos Purple Urkle?". Vos abrís el sobre *en tu casa*, mirás la carta, calculás un **certificado matemático** que dice: "la respuesta es SÍ, y lo puedo probar sin mostrar la carta". Le mandás sólo ese certificado al árbitro.
>
> **El árbitro verifica tres cosas:**
> 1. ¿El certificado corresponde al sobre que me mandaste al principio? *(binding)*
> 2. ¿Esa carta existe realmente en la colección oficial? *(Merkle)*
> 3. ¿La respuesta que das es lo que realmente dice la carta? *(extracción del bit)*
>
> Si los tres checks pasan → el árbitro publica "respuesta: SÍ" en la blockchain. El rival nunca vio tu carta.

---

## La Partida Real — Schizodio #41

### Tus Rasgos (inputs privados que nunca salen de tu dispositivo)

```
character_id = 41

Atributos:
  Background  → Sleepy Hollow
  Body        → Snowflake
  Mouth       → Squiggle
  Eyes        → Purple Urkle       ← clave para nuestro ejemplo
  Eyebrows    → Blue Notched Slit
  Hair        → Red Jellycut
  Clothing    → Turkey Camo Tshirt
  Sidekick    → Baboon
  Overlays    → Zabubu Pack
  (resto "No X" → no ocupan bit)
```

### El Mapa de Bits (trait_bitmap: [u128; 4])

El circuito no trabaja con texto. Convierte los rasgos en un número gigante de 512 bits donde cada posición es SÍ(1) o NO(0):

```
Bit 80  = 1  → background_sleepy_hollow     ✓
Bit 104 = 1  → body_snowflake               ✓
Bit 173 = 1  → clothing_turkey_camo_tshirt  ✓
Bit 182 = 1  → eyebrows_blue_notched_slit   ✓
Bit 207 = 1  → eyes_purple_urkle            ✓  ← la pregunta de hoy
Bit 252 = 1  → hair_red_jellycut            ✓
Bit 308 = 1  → mouth_squiggle               ✓
Bit 349 = 1  → overlays_zabubu_pack         ✓
Bit 353 = 1  → sidekick_baboon              ✓
(todos los demás = 0)
```

Dividido en 4 limbs de 128 bits cada uno:
```
limb0 (bits   0-127) = 0x000100000100000000000000000000
limb1 (bits 128-255) = 0x10000000000080000040200000000000
limb2 (bits 256-383) = 0x000002200000000010000000000000000
limb3 (bits 384-511) = 0x0
```

---

## Paso 1 — El Compromiso (Commitment Binding)

```noir
let expected_commitment = hash4(game_id, player, character_id, salt);
assert(expected_commitment == commitment);
```

**Qué hace:** Prueba que el personaje que estás usando ahora es el mismo que bloqueaste al inicio.

**Datos reales en la partida:**
```
game_id      = 0xABC123              (ID de tu partida)
player       = 0x04a3b...            (tu wallet)
character_id = 41                    (PRIVADO — nunca sale)
salt         = 0x9f3e...             (PRIVADO — número aleatorio)

hash4(game_id, player, 41, salt) → 0x29ab...
                                    ↕ debe coincidir
commitment on-chain              → 0x29ab...  ✓
```

**Analogía:** El código del sello de cera. Si intentás cambiar la carta a Schizodio #777 a mitad de partida, el hash daría `0x4411...` en vez de `0x29ab...` → el assert falla → prueba rechazada.

---

## Paso 2 — Membresía en el Árbol Merkle

```noir
let leaf = hash5(character_id, trait_bitmap[0..3]);
let computed_root = merkle::merkle_verify(leaf, character_id, merkle_path);
assert(computed_root == traits_root);
```

**Qué hace:** Prueba que el bitmap que usás es el oficial de la colección — no uno inventado.

**Datos reales:**
```
leaf = hash5(41, limb0, limb1, limb2, limb3)
     = 0x14d06f26d5e4beb03074c01a89bec4db20bdea35e92d103f8c0d746c0cce605f

merkle_path (10 hermanos para subir desde la hoja hasta la raíz):
  [0] = 0x17273ca3f79a7ce45f00d92319678462c47ad4d64f7278326364c4e7593ab421
  [1] = 0x2bff54ed6597296fc627d8cd4cfabacfa0e667b12940ffc8090858c94d969447
  [2] = 0x16ce678db1fc3b4ffce20c3e0d5e2ba4e879328b90d7c7a9688d2b46a42cc972
  [3] = 0x2af8b18880ec1b13e0855c2c246d6de0b9bae7ce4de1e53bbb0777aafea9c03d
  [4] = 0x2b152a53de8e5a923169dcf78badaac8e56e703a6d7ae460005d856485702d3a
  [5] = 0x2ec82247d68dcc0156fc1786340e7ad9bc942cb210ff100cff87c4a844a840c0
  [6] = 0x2ab2757d5017767df890add6c15e0d769095b2c389cc7f6789cf74583918c26c
  [7] = 0x1262974ced94915ed7739812c2579d0e396bbd85bea077f8522563208c3c848e
  [8] = 0x1d387cb270d1d9af75e974c1da132568d61e981327f17e13c854234e60989844
  [9] = 0x70ed1571b8cae5d44ff2e9a70f05aa96a1b9871f5a51d712fa6b5c8761fb42c

computed_root = 0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897
                ↕ debe coincidir
traits_root   = 0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897  ✓
```

**Analogía:** El árbol de registros es como una pirámide de hasheos. Tu carta (#41) está en la base. Para demostrar que es oficial, subís por la pirámide usando los 10 hermanos `merkle_path`, calculando el hash en cada nivel. Si llegás a la cima (`traits_root = 0x296f...`) que está grabada en el contrato → probado. Si inventaste un bitmap falso, jamás llegarías a esa raíz exacta.

```
Raíz:        0x296f3664...   ← grabada en el contrato, inmutable
              /         \
         hash(...)     hash(...)
          /    \
     hash(...)  hash(...)
        ...
  hoja #41: 0x14d06f...   ← tu personaje
```

---

## Paso 3 — Extracción del Bit (Answer Correctness)

```noir
let limb_idx = (question_id / 128) as u8;
let bit_idx  = (question_id % 128) as u8;
let limb     = trait_bitmap[limb_idx];
let answer_bit = ((limb >> (bit_idx as u128)) & 1) as u1;
```

**Qué hace:** Lee el bit exacto del mapa que corresponde a la pregunta.

**Partida real — pregunta: "¿Tu personaje tiene ojos Purple Urkle?"**
```
question_id = 207   (bit 207 en el schema = eyes_purple_urkle)

limb_idx = 207 / 128 = 1   → usar limb[1]
bit_idx  = 207 % 128 = 79  → bit 79 dentro de limb[1]

limb[1] = 0x10000000000080000040200000000000 (en binario, bit 79 = 1)

answer_bit = (limb[1] >> 79) & 1 = 1   →  ¡SÍ! ✓
```

**Pregunta alternativa — "¿Tu personaje tiene ojos Four Spots?"**
```
question_id = 200   → limb_idx=1, bit_idx=72
bit 72 del limb[1] = 0 → NO ✓ (el #41 tiene Purple Urkle, no Four Spots)
```

**Analogía:** El bitmap es como una planilla de 512 casillas con SÍ/NO para cada rasgo posible. La pregunta te dice en qué fila mirar. El circuito va exactamente a esa casilla y lee el valor. Sin trampa posible porque el bitmap ya fue validado en el paso 2.

---

## Paso 4 — Anti-Replay (Implícito)

```noir
let _ = turn_id; // ligado como input público, sin constraint extra
```

`game_id` y `turn_id` son inputs públicos, quedan **criptográficamente ligados** a la prueba. El contrato Dojo verifica que coincidan con el estado actual del juego. Una prueba válida del turno 3 no puede reutilizarse en el turno 7 — sería detectada inmediatamente.

---

## Flujo Completo de una Ronda

```
FASE COMMIT (inicio de partida):
  Vos → elegís #41, generás sal aleatoria
  Publicás: commitment = hash4(game_id, wallet, 41, sal)
  → La blockchain guarda tu "sobre sellado"

FASE PREGUNTA (rival pregunta turno 5):
  Rival → "¿Ojos Purple Urkle?"   (question_id = 207)

  Tu navegador genera la prueba ZK con:
  ┌──────────────────────────────────────────────────────┐
  │ Constraint 1: hash4(..., 41, sal) == 0x29ab...  ✓   │
  │ Constraint 2: leaf #41 → raíz 0x296f...         ✓   │
  │ Constraint 3: bit 207 del bitmap == 1            ✓   │
  └──────────────────────────────────────────────────────┘
  → Prueba + answer_bit=1 van a la blockchain

CONTRATO DOJO:
  garaga verifica la prueba matemática
  Publica: "Turno 5 → respuesta: SÍ"
  El personaje #41 sigue siendo secreto ✓
```

**Lo que el rival aprende:** sólo "SÍ, tiene Purple Urkle". Nada más.
**Lo que el rival NO sabe:** que es el Schizodio #41, con Baboon de sidekick, Zabubu Pack de overlay, fondo Sleepy Hollow, etc.
