# Инструкция: отправка уведомлений в MAX из Help-Desk

Gateway можно использовать **только для исходящих сообщений**, без webhook и без опроса событий.

Help-Desk → `POST /api/v1/send` → Gateway → MAX API → пользователь в мессенджере MAX.

---

## 1. Что нужно от администратора gateway

Перед настройкой Help-Desk запросите у администратора:


| Параметр           | Пример                        | Описание                                    |
| ------------------ | ----------------------------- | ------------------------------------------- |
| **Base URL**       | `https://max.mebel-alivia.ru` | Адрес gateway                               |
| **Internal token** | `...`                         | `Authorization: Bearer <token>`             |
| **IP Help-Desk**   | `203.0.113.50`                | Для whitelist в nginx (если сервер вне VPN) |


Администратор добавит IP Help-Desk в `/etc/nginx/sites-available/max-gateway` → `location /api/` → `allow ...`.

**MAX bot token в Help-Desk не нужен** — только internal token gateway.

---

## 2. Что НЕ нужно для Help-Desk

Если Help-Desk **только шлёт уведомления**, не требуется:

- webhook `/webhook/max`
- poll `GET /api/v1/events/pending`
- ack / fail
- токен MAX API
- long polling / подписки MAX (если бот используется только для исходящих от Help-Desk и другой логики нет)

> Если бот **также** принимает сообщения от пользователей (другая система, например 1С) — webhook и poll остаются для входящих. Help-Desk использует только `/send`.

---

## 3. API для Help-Desk

### Endpoint

```http
POST https://max.mebel-alivia.ru/api/v1/send
Authorization: Bearer <INTERNAL_API_TOKEN>
Content-Type: application/json; charset=utf-8
```

### Тело запроса

**Отправка пользователю:**

```json
{
  "user_id": 190304297,
  "text": "Заявка #1234 принята в работу"
}
```

**Отправка в чат:**

```json
{
  "chat_id": 123456789,
  "text": "Новый тикет назначен на группу поддержки"
}
```


| Поле          | Тип    | Обязательно  | Описание                            |
| ------------- | ------ | ------------ | ----------------------------------- |
| `user_id`     | int    | одно из двух | ID пользователя в MAX               |
| `chat_id`     | int    | одно из двух | ID чата в MAX                       |
| `text`        | string | да           | Текст уведомления (1–4000 символов) |
| `attachments` | array  | нет          | Кнопки / клавиатура (см. ниже)      |


**Ровно одно** из полей: `user_id` **или** `chat_id`.

### Успешный ответ `200`

```json
{
  "id": 42,
  "status": "sent",
  "max_response": { }
}
```

`max_response` — ответ MAX API (структура может отличаться).

### Ошибки


| HTTP  | Причина                                          |
| ----- | ------------------------------------------------ |
| `401` | Неверный Bearer token                            |
| `403` | IP Help-Desk не в whitelist nginx — см. раздел 10 ниже |
| `422` | Неверное тело (нет user_id/chat_id, пустой text) |
| `502` | MAX не принял сообщение (смотреть `detail`)      |


---

## 4. Пример с кнопкой (опционально)

```json
{
  "user_id": 190304297,
  "text": "Заявка #1234 обновлена. Открыть?",
  "attachments": [
    {
      "type": "inline_keyboard",
      "payload": {
        "buttons": [
          [
            { "text": "Открыть тикет", "callback_data": "ticket_1234" }
          ]
        ]
      }
    }
  ]
}
```

Структура `attachments` — по документации MAX API. Gateway передаёт массив **без изменений**.

---

## 5. Настройка Help-Desk (общая схема)

### Шаг 1. Канал уведомлений

Создайте канал/интеграцию «MAX Messenger» (или HTTP webhook):

- **URL:** `https://max.mebel-alivia.ru/api/v1/send`
- **Method:** `POST`
- **Headers:**
  - `Authorization: Bearer <INTERNAL_API_TOKEN>`
  - `Content-Type: application/json; charset=utf-8`

### Шаг 2. Шаблон тела запроса

Подставьте поля из заявки Help-Desk:

```json
{
  "user_id": {{max_user_id}},
  "text": "Заявка #{{ticket_id}}: {{status}}. {{comment}}"
}
```

Имена переменных (`{{max_user_id}}` и т.д.) — по возможностям вашего Help-Desk.

### Шаг 3. ID пользователя MAX

В карточке клиента / заявки должно храниться поле `**max_user_id**` (число), полученное при регистрации пользователя в боте или из другой интеграции.

Без `user_id` или `chat_id` отправка невозможна.

### Шаг 4. Триггеры

Настройте отправку при событиях, например:

- создание заявки;
- смена статуса;
- новый комментарий оператора;
- назначение исполнителя;
- закрытие заявки.

### Шаг 5. Обработка ошибок

- **401** — проверить token у администратора gateway.
- **403** — передать администратору внешний IP Help-Desk для whitelist.
- **502** — логировать `detail`, повторить позже или уведомить администратора.

Рекомендуется логировать HTTP-код и тело ответа в Help-Desk.

---

## 6. Примеры вызова

### curl

```bash
curl -s -X POST "https://max.mebel-alivia.ru/api/v1/send" \
  -H "Authorization: Bearer YOUR_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 190304297,
    "text": "Ваша заявка #5678 переведена в статус «В работе»"
  }'
```

### PowerShell

```powershell
$headers = @{
    Authorization = "Bearer YOUR_INTERNAL_TOKEN"
    "Content-Type" = "application/json; charset=utf-8"
}
$body = @{
    user_id = 190304297
    text = "Ваша заявка #5678 переведена в статус «В работе»"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://max.mebel-alivia.ru/api/v1/send" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### Python

```python
import httpx

response = httpx.post(
    "https://max.mebel-alivia.ru/api/v1/send",
    headers={
        "Authorization": "Bearer YOUR_INTERNAL_TOKEN",
        "Content-Type": "application/json; charset=utf-8",
    },
    json={
        "user_id": 190304297,
        "text": "Заявка #5678: новый комментарий от поддержки",
    },
    timeout=30.0,
)
response.raise_for_status()
print(response.json())
```

---

## 7. Checklist для внедрения

**Администратор gateway:**

- Выдан `INTERNAL_API_TOKEN` для Help-Desk
- IP Help-Desk добавлен в nginx whitelist (`/api/`)
- `curl` send с VPS/Help-Desk возвращает `200`

**Help-Desk:**

- Настроен HTTP POST на `/api/v1/send`
- В заявках/клиентах есть `max_user_id` (или `chat_id`)
- Шаблоны уведомлений заполнены
- Триггеры на нужные события
- Логирование ошибок HTTP

---

## 8. Безопасность

- Не храните token в открытом виде в UI — используйте секреты/переменные окружения Help-Desk.
- Не передавайте MAX bot token в Help-Desk.
- Используйте только HTTPS.
- Ограничьте доступ к `/api/` по IP (на стороне nginx).

---

## 9. Мониторинг (для администратора)

Проверка отправок Help-Desk в БД gateway:

```bash
docker compose exec postgres psql -U gateway -d gateway -c \
  "SELECT id, created_at, target_id, left(text,60), status FROM outgoing_messages ORDER BY id DESC LIMIT 10;"
```

Health gateway:

```bash
curl -s https://max.mebel-alivia.ru/health
```

---

## 10. Ошибка 403 Forbidden

Nginx Gateway разрешает `/api/` только с IP из whitelist. Публичный URL `https://max.mebel-alivia.ru/api/v1/send` с сервера D-org часто получает **403**, если внешний IP D-org не добавлен в nginx.

### Вариант A — D-org и Gateway на одном VPS (рекомендуется)

В `.env` D-org укажите прямой доступ к приложению gateway (минуя nginx):

```env
MAX_GATEWAY_URL=http://host.docker.internal:8000/api/v1/send
```

В `docker-compose.prod.yml` backend должен иметь:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Пересоберите backend:

```bash
cd ~/D-org && docker compose -f docker-compose.prod.yml up -d --build backend
```

Проверка с сервера D-org:

```bash
docker compose -f docker-compose.prod.yml exec backend python -c "
import httpx, os
url = os.environ.get('MAX_GATEWAY_URL', '')
token = os.environ.get('MAX_GATEWAY_TOKEN', '')
r = httpx.post(url, json={'user_id': 1, 'text': 'test'}, headers={'Authorization': f'Bearer {token}'}, timeout=10)
print(r.status_code, r.text[:200])
"
```

Ожидаемо: `200` или `502` (если user_id тестовый не существует в MAX), но **не 403**.

### Вариант B — серверы на разных IP

1. Узнайте внешний IP сервера D-org:

```bash
curl -s ifconfig.me
```

2. На сервере `max.mebel-alivia.ru` откройте `/etc/nginx/sites-available/max-gateway`, в блоке `location /api/` добавьте:

```nginx
allow 203.0.113.50/32;   # IP сервера ai.mebel-alivia.ru
```

3. Примените конфиг:

```bash
nginx -t && systemctl reload nginx
```

4. В `.env` D-org оставьте публичный URL:

```env
MAX_GATEWAY_URL=https://max.mebel-alivia.ru/api/v1/send
```

