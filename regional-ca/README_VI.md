# Regional Custom Activity — Cloudflare Pages v2

Bản này triển khai theo Cloudflare Pages + Pages Functions, KHÔNG dùng Workers src/index.js hay wrangler.jsonc của hướng dẫn trước. UI reward gốc được giữ ở original-ui/; UI /regional/ mới cấu hình Notification Hub. Chưa deploy thay anh; chưa test trực tiếp trên SFMC hoặc Hub thật.

## 1. Upload GitHub
Giải nén ZIP, upload NỘI DUNG bên trong regional-ca vào ngoài cùng repository. Cần có public/, functions/, lib/, package.json và package-lock.json. Không upload node_modules hoặc secret. Xóa wrangler.jsonc / wrangler.toml cấu hình Workers cũ nếu còn trong repository. original-ui/ chỉ là bản tham chiếu, không public.

## 2. Cloudflare Pages build
- Framework preset: None
- Build command: để trống
- Build output directory: public
- Root directory: để mặc định (package.json nằm ngoài cùng repo)
- Deployment qua Git integration; Cloudflare bundle functions/ khi deploy. Không chỉ drag-upload folder static nếu muốn chạy Functions.
- Upload source code không xử lý được lỗi Cloudflare "build failed to initialize in time"; retry deployment nếu gặp lỗi đó.

## 3. Biến runtime
Cloudflare → Workers & Pages → regional-ca → Settings → Variables and Secrets (tên nhóm có thể khác theo UI).
Cấu hình Production; nếu test URL Preview thì thêm cùng biến cho Preview. Redeploy sau thay đổi.

| Biến | Loại | Giá trị |
|---|---|---|
| SFMC_JWT_SECRET | Secret | JWT Signing Secret của Installed Package; KHÔNG phải API Client Secret |
| HUB_MODE | Text | dry-run hoặc live; mặc định dry-run |
| HUB_URL | Text | URL HTTPS đầy đủ, ví dụ https://your-hub.example/v1/message (bắt buộc live) |
| HUB_BEARER_TOKEN | Secret | Token Hub nếu Hub dùng Bearer authentication |

Signing secret dùng HS256, JWT nhận trong raw POST body. JWT hết hạn / sai chữ ký → 401. Secret chưa cấu hình → 503. Không có public JSON webhook bypass.

## 4. Installed Package
- Kiểm tra https://regional-ca.pages.dev/health → JSON ok.
- Kiểm tra https://regional-ca.pages.dev/regional/config.json → JSON, không phải HTML.
- Setup → Apps → Installed Packages → New hoặc package hiện có → Add Component → Journey Builder Activity → Custom Activity.
- Endpoint URL: https://regional-ca.pages.dev/regional/
- Lấy JWT Signing Secret, lưu vào Cloudflare như bước 3.
- Refresh Journey Builder; kéo Regional Notification Hub vào Journey.
- Nếu project/domain khác regional-ca.pages.dev: sửa TẤT CẢ URL trong public/regional/config.json trước deploy.

## 5. UI mapping Entry DE
Ví dụ Entry DE: ContactKey (Customer ID), Phone (E.164), Voucher.
Chọn Entry Event trước. UI tự lấy Event Definition Key; nếu không lấy được, nhập đúng key của Entry Event.
- Template key: lc.promo.spring.sms
- Correlation ID: SF-CAMP-2026Q4
- Idempotency scope: SF-CAMP-2026Q4-SMS-STEP1-RUN1
- Customer ID field: ContactKey
- Phone field: Phone
- Voucher field: Voucher; hoặc để trống và nhập Voucher cố định SALE50.
- Nhấn Done của Journey để lưu. Khi mở lại activity, cấu hình đã lưu được restore.
Field mapping bản này hỗ trợ tên chữ, số, dấu _. Customer ID không bắt buộc UUID; cần đúng định danh Hub sử dụng.

## 6. Parse payload
execute nhận JWT Salesforce; sau verify, merge các object trong inArguments. Hỗ trợ:
1. SFMC singleton: examples/sfmc-execute.json.
2. Hub-shaped batch có recipients: examples/hub-payload.json; cũng có thể bọc ở inArguments:[{payload:{...}}].

Output chính xác các field source, idempotencyKey, templateKey, correlationId, recipients[].addresses/customerId/params. source luôn là salesforce. Một execute từ UI tạo một recipient, không tự gom contact. Mẫu batch 2 recipients là parser test, không khẳng định Journey gửi batch.

Nếu không có explicit idempotencyKey, backend tạo scope:customerId cho singleton. Batch bắt buộc explicit key. Hub PHẢI thực thi idempotency theo key; backend này không có durable dedup store. Cùng customer + scope sẽ có cùng key. Khi re-entry có chủ ý hoặc campaign mới, đổi scope hoặc cung cấp key theo occurrence từ DE trong code mở rộng. Không dùng một key cố định cho toàn bộ contact.

Phone phải là +84900000001; **+84900000001** là giá trị sai, sẽ bị từ chối (không tự bỏ dấu). Params hỗ trợ scalar string/number/boolean; không array/object/null. Unresolved {{Event...}} bị từ chối. Tối đa parser 1000 recipients/request; đây là giới hạn bản demo, không phải xác nhận limit Hub.

## 7. Dry-run / live
- dry-run: verify + parse rồi trả 200 {ok:true, mode:"dry-run", sent:false, payload:...}; không gửi SMS. Payload trả về chỉ cho caller đã xác thực, không log phone/customerId/token.
- live: POST JSON tới HUB_URL, thêm Idempotency-Key, X-Correlation-ID, Bearer token nếu có. Chỉ trả success sau Hub trả HTTP 2xx. Điều này là Hub chấp nhận request, KHÔNG xác nhận tin đã delivered.
- Hub lỗi/timeout → 502; payload lỗi → 400. HTTP timeout backend 8s; execute timeout config 10s. Đây là synchronous adapter bản test, chưa có queue/worker gửi nền. Không dùng ở tải lớn trước khi bổ sung queue, durable dedup, theo dõi và load test.
- Lifecycle save/validate/publish/stop verify JWT rồi ACK; validate chỉ xác thực callback, không kiểm tra template tồn tại tại Hub. Validation payload được thực hiện tại execute.
- Không tự retry call Hub trong backend; SFMC retry có thể gọi lại /execute với cùng key. Có thể xảy ra Hub nhận rồi response timeout; Hub dedup là bắt buộc để tránh gửi trùng.
- Live URL / credential là cấu hình tin cậy quản trị, không nhận từ payload người dùng.

## 8. Test local
Cài Node.js LTS:
```bash
npm ci
npm test
cp .dev.vars.example .dev.vars
npm run dev
```
Nhập secret test trong .dev.vars. Để test route với signed JWT:
```bash
node scripts/sign-example.js examples/sfmc-execute.json > /tmp/regional-token.txt
curl -X POST http://localhost:8788/execute -H 'Content-Type: application/jwt' --data-binary @/tmp/regional-token.txt
```
Script sign đọc SFMC_JWT_SECRET từ environment hoặc .dev.vars local. Chỉ dùng test, không commit .dev.vars và không gửi JWT cho bên thứ ba.
Kiểm tra live bằng test contact sau dry-run; quan sát log Functions trên Cloudflare. Không test gửi với contact thật khi chưa kiểm tra template/consent.

## 9. Endpoints
GET /health; POST /execute /save /validate /publish /stop. GET callback trả 405.
UI: /regional/. Endpoint Installed Package: /regional/.
Static assets không bị X-Frame-Options DENY/SAMEORIGIN trong gói. Nếu bật Cloudflare Access/challenge cho UI/callback, Salesforce có thể không truy cập được; phải cấu hình routing phù hợp.

## Tài liệu
https://developers.cloudflare.com/pages/functions/get-started/
https://developers.cloudflare.com/pages/functions/routing/
https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/encode-custom-activities-using-jwt-app-signature
https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/custom-activity-config.html
