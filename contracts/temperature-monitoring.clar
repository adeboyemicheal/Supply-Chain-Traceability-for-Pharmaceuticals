;; Temperature Monitoring Contract
;; This contract ensures proper storage conditions for medications

(define-data-var admin principal tx-sender)

;; Structure for temperature records
(define-map temperature-records
  { batch-id: (string-ascii 32), timestamp: uint }
  {
    temperature: int,
    humidity: uint,
    recorder: principal,
    location: (string-ascii 64)
  }
)

;; Map to track temperature thresholds for batches
(define-map batch-thresholds
  { batch-id: (string-ascii 32) }
  {
    min-temp: int,
    max-temp: int,
    min-humidity: uint,
    max-humidity: uint
  }
)

;; Map to track temperature violations
(define-map temperature-violations
  { batch-id: (string-ascii 32) }
  { count: uint }
)

;; Error codes
(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_INVALID_PARAMETERS u101)
(define-constant ERR_THRESHOLD_NOT_SET u102)

;; Function to set temperature thresholds for a batch
(define-public (set-batch-thresholds
    (batch-id (string-ascii 32))
    (min-temp int)
    (max-temp int)
    (min-humidity uint)
    (max-humidity uint))
  (begin
    (asserts! (< min-temp max-temp) (err ERR_INVALID_PARAMETERS))
    (asserts! (< min-humidity max-humidity) (err ERR_INVALID_PARAMETERS))

    (map-set batch-thresholds
      { batch-id: batch-id }
      {
        min-temp: min-temp,
        max-temp: max-temp,
        min-humidity: min-humidity,
        max-humidity: max-humidity
      }
    )

    ;; Initialize violation count if not exists
    (if (is-none (map-get? temperature-violations { batch-id: batch-id }))
      (map-set temperature-violations { batch-id: batch-id } { count: u0 })
      true
    )

    (ok true)
  )
)

;; Function to record temperature
(define-public (record-temperature
    (batch-id (string-ascii 32))
    (temperature int)
    (humidity uint)
    (location (string-ascii 64)))
  (let (
      (thresholds (unwrap! (map-get? batch-thresholds { batch-id: batch-id }) (err ERR_THRESHOLD_NOT_SET)))
      (current-violations (default-to { count: u0 } (map-get? temperature-violations { batch-id: batch-id })))
      (violation-detected false)
    )

    ;; Record the temperature data
    (map-set temperature-records
      { batch-id: batch-id, timestamp: block-height }
      {
        temperature: temperature,
        humidity: humidity,
        recorder: tx-sender,
        location: location
      }
    )

    ;; Check for violations
    (if (or
          (< temperature (get min-temp thresholds))
          (> temperature (get max-temp thresholds))
          (< humidity (get min-humidity thresholds))
          (> humidity (get max-humidity thresholds)))
      (begin
        (map-set temperature-violations
          { batch-id: batch-id }
          { count: (+ (get count current-violations) u1) }
        )
        (ok false) ;; Return false to indicate violation
      )
      (ok true)
    )
  )
)

;; Function to get temperature record
(define-read-only (get-temperature-record (batch-id (string-ascii 32)) (timestamp uint))
  (map-get? temperature-records { batch-id: batch-id, timestamp: timestamp })
)

;; Function to get batch thresholds
(define-read-only (get-batch-thresholds (batch-id (string-ascii 32)))
  (map-get? batch-thresholds { batch-id: batch-id })
)

;; Function to get violation count
(define-read-only (get-violation-count (batch-id (string-ascii 32)))
  (default-to { count: u0 } (map-get? temperature-violations { batch-id: batch-id }))
)
