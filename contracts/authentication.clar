;; Authentication Contract
;; This contract allows verification of medication legitimacy

(define-data-var admin principal tx-sender)

;; Map to store product authentication codes
(define-map authentication-codes
  { code: (string-ascii 64) }
  {
    batch-id: (string-ascii 32),
    product-id: (string-ascii 32),
    is-valid: bool,
    verification-count: uint
  }
)

;; Map to track verification history
(define-map verification-history
  { code: (string-ascii 64), index: uint }
  {
    verifier: principal,
    timestamp: uint,
    location: (string-ascii 64)
  }
)

;; Map to track history count per code
(define-map verification-counts
  { code: (string-ascii 64) }
  { count: uint }
)

;; Error codes
(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_CODE_EXISTS u101)
(define-constant ERR_CODE_NOT_FOUND u102)
(define-constant ERR_CODE_INVALID u103)

;; Function to generate authentication codes for a batch
(define-public (generate-authentication-code
    (code (string-ascii 64))
    (batch-id (string-ascii 32))
    (product-id (string-ascii 32)))
  (begin
    (asserts! (is-none (map-get? authentication-codes { code: code })) (err ERR_CODE_EXISTS))

    ;; Set authentication code data
    (map-set authentication-codes
      { code: code }
      {
        batch-id: batch-id,
        product-id: product-id,
        is-valid: true,
        verification-count: u0
      }
    )

    ;; Initialize verification count
    (map-set verification-counts
      { code: code }
      { count: u0 }
    )

    (ok true)
  )
)

;; Function to verify an authentication code
(define-public (verify-authentication-code
    (code (string-ascii 64))
    (location (string-ascii 64)))
  (let (
      (code-data (unwrap! (map-get? authentication-codes { code: code }) (err ERR_CODE_NOT_FOUND)))
      (history-data (unwrap! (map-get? verification-counts { code: code }) (err ERR_CODE_NOT_FOUND)))
      (current-count (get count history-data))
    )

    ;; Check if code is valid
    (asserts! (get is-valid code-data) (err ERR_CODE_INVALID))

    ;; Update verification count
    (map-set authentication-codes
      { code: code }
      (merge code-data { verification-count: (+ (get verification-count code-data) u1) })
    )

    ;; Add verification history
    (map-set verification-history
      { code: code, index: current-count }
      {
        verifier: tx-sender,
        timestamp: block-height,
        location: location
      }
    )

    ;; Update history count
    (map-set verification-counts
      { code: code }
      { count: (+ current-count u1) }
    )

    (ok {
      batch-id: (get batch-id code-data),
      product-id: (get product-id code-data),
      verification-count: (+ (get verification-count code-data) u1)
    })
  )
)

;; Function to invalidate an authentication code
(define-public (invalidate-authentication-code (code (string-ascii 64)))
  (let ((code-data (unwrap! (map-get? authentication-codes { code: code }) (err ERR_CODE_NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))

    ;; Mark code as invalid
    (map-set authentication-codes
      { code: code }
      (merge code-data { is-valid: false })
    )

    (ok true)
  )
)

;; Function to get authentication code information
(define-read-only (get-authentication-info (code (string-ascii 64)))
  (map-get? authentication-codes { code: code })
)

;; Function to get verification history entry
(define-read-only (get-verification-history (code (string-ascii 64)) (index uint))
  (map-get? verification-history { code: code, index: index })
)

;; Function to get verification count
(define-read-only (get-verification-count (code (string-ascii 64)))
  (default-to { count: u0 } (map-get? verification-counts { code: code }))
)
