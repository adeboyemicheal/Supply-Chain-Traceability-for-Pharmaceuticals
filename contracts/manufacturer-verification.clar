;; Manufacturer Verification Contract
;; This contract validates legitimate drug producers

(define-data-var admin principal tx-sender)

;; Map to store verified manufacturers
(define-map verified-manufacturers principal bool)

;; Error codes
(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_ALREADY_VERIFIED u101)
(define-constant ERR_NOT_FOUND u102)

;; Function to verify a manufacturer
(define-public (verify-manufacturer (manufacturer principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-none (map-get? verified-manufacturers manufacturer)) (err ERR_ALREADY_VERIFIED))
    (map-set verified-manufacturers manufacturer true)
    (ok true)
  )
)

;; Function to revoke verification
(define-public (revoke-verification (manufacturer principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-some (map-get? verified-manufacturers manufacturer)) (err ERR_NOT_FOUND))
    (map-delete verified-manufacturers manufacturer)
    (ok true)
  )
)

;; Function to check if a manufacturer is verified
(define-read-only (is-verified (manufacturer principal))
  (default-to false (map-get? verified-manufacturers manufacturer))
)

;; Function to transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
