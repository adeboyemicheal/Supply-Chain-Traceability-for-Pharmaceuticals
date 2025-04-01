;; Batch Tracking Contract
;; This contract monitors medications through distribution

(define-data-var admin principal tx-sender)

;; Structure for batch information
(define-map batches
  { batch-id: (string-ascii 32) }
  {
    manufacturer: principal,
    product-id: (string-ascii 32),
    production-date: uint,
    expiry-date: uint,
    current-custodian: principal,
    status: (string-ascii 20)
  }
)

;; Map to track batch history
(define-map batch-history
  { batch-id: (string-ascii 32), index: uint }
  {
    timestamp: uint,
    custodian: principal,
    action: (string-ascii 20)
  }
)

;; Map to track history count per batch
(define-map history-counts
  { batch-id: (string-ascii 32) }
  { count: uint }
)

;; Error codes
(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_BATCH_EXISTS u101)
(define-constant ERR_BATCH_NOT_FOUND u102)
(define-constant ERR_NOT_CURRENT_CUSTODIAN u103)

;; Function to register a new batch
(define-public (register-batch
    (batch-id (string-ascii 32))
    (product-id (string-ascii 32))
    (production-date uint)
    (expiry-date uint))
  (let ((manufacturer tx-sender))
    (asserts! (is-none (map-get? batches { batch-id: batch-id })) (err ERR_BATCH_EXISTS))

    ;; Set initial batch data
    (map-set batches
      { batch-id: batch-id }
      {
        manufacturer: manufacturer,
        product-id: product-id,
        production-date: production-date,
        expiry-date: expiry-date,
        current-custodian: manufacturer,
        status: "produced"
      }
    )

    ;; Initialize history count
    (map-set history-counts
      { batch-id: batch-id }
      { count: u1 }
    )

    ;; Record first history entry
    (map-set batch-history
      { batch-id: batch-id, index: u0 }
      {
        timestamp: block-height,
        custodian: manufacturer,
        action: "produced"
      }
    )

    (ok true)
  )
)

;; Function to transfer batch custody
(define-public (transfer-batch
    (batch-id (string-ascii 32))
    (new-custodian principal)
    (action (string-ascii 20)))
  (let (
      (batch-data (unwrap! (map-get? batches { batch-id: batch-id }) (err ERR_BATCH_NOT_FOUND)))
      (history-data (unwrap! (map-get? history-counts { batch-id: batch-id }) (err ERR_BATCH_NOT_FOUND)))
      (current-count (get count history-data))
    )

    ;; Verify sender is current custodian
    (asserts! (is-eq tx-sender (get current-custodian batch-data)) (err ERR_NOT_CURRENT_CUSTODIAN))

    ;; Update batch data
    (map-set batches
      { batch-id: batch-id }
      (merge batch-data { current-custodian: new-custodian, status: action })
    )

    ;; Add history entry
    (map-set batch-history
      { batch-id: batch-id, index: current-count }
      {
        timestamp: block-height,
        custodian: new-custodian,
        action: action
      }
    )

    ;; Update history count
    (map-set history-counts
      { batch-id: batch-id }
      { count: (+ current-count u1) }
    )

    (ok true)
  )
)

;; Function to get batch information
(define-read-only (get-batch-info (batch-id (string-ascii 32)))
  (map-get? batches { batch-id: batch-id })
)

;; Function to get batch history entry
(define-read-only (get-batch-history-entry (batch-id (string-ascii 32)) (index uint))
  (map-get? batch-history { batch-id: batch-id, index: index })
)

;; Function to get history count for a batch
(define-read-only (get-history-count (batch-id (string-ascii 32)))
  (default-to { count: u0 } (map-get? history-counts { batch-id: batch-id }))
)
