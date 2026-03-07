#!/usr/bin/env python3
"""
Benchmark script for AnkiConnect card retrieval with different batch sizes.

This script tests various batch sizes to determine the optimal batching strategy
for retrieving card information from Anki.
"""

import requests
import time
import json
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple


ANKI_CONNECT_URL = "http://127.0.0.1:8765/"
HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,ja;q=0.8,fr-FR;q=0.7,fr;q=0.6",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/plain",
    "DNT": "1",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}


def anki_request(action: str, params: Dict = None) -> Dict:
    """Make a request to AnkiConnect API."""
    payload = {"action": action, "version": 6}
    if params:
        payload["params"] = params

    response = requests.post(ANKI_CONNECT_URL, json=payload, headers=HEADERS)
    response.raise_for_status()
    return response.json()


def get_all_card_ids(query: str = '"deck:Japan::1. Vocabulary"') -> List[int]:
    """Retrieve all card IDs matching the query."""
    print(f"\n🔍 Fetching all card IDs with query: '{query}'...")
    start_time = time.time()

    result = anki_request("findCards", {"query": query})

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    card_ids = result.get("result", [])
    elapsed = time.time() - start_time

    print(f"✓ Found {len(card_ids):,} cards in {elapsed:.3f}s")
    return card_ids


def benchmark_batch_size(card_ids: List[int], batch_size: int, num_runs: int = 1) -> Tuple[float, float]:
    """
    Benchmark a specific batch size.

    Returns:
        Tuple of (average_time_per_request, total_time_for_all_cards)
    """
    times = []
    total_batches = (len(card_ids) + batch_size - 1) // batch_size

    for run in range(num_runs):
        run_times = []
        run_start_time = time.time()
        cards_processed = 0

        # Process cards in batches
        for batch_idx, i in enumerate(range(0, len(card_ids), batch_size), 1):
            batch = card_ids[i:i + batch_size]
            cards_processed += len(batch)

            start_time = time.time()
            result = anki_request("cardsInfo", {"cards": batch})
            end_time = time.time()

            if result.get("error"):
                raise Exception(f"AnkiConnect error: {result['error']}")

            request_time = end_time - start_time
            run_times.append(request_time)

            # Progress logging every 10 batches or on last batch
            if batch_idx % 10 == 0 or batch_idx == total_batches:
                elapsed = time.time() - run_start_time
                progress_pct = (cards_processed / len(card_ids)) * 100
                print(f"    Run {run + 1}/{num_runs}: Batch {batch_idx}/{total_batches} "
                      f"({progress_pct:.1f}% - {cards_processed}/{len(card_ids)} cards) - "
                      f"Last request: {request_time:.3f}s - Elapsed: {elapsed:.1f}s")

        total_time = sum(run_times)
        times.append(total_time)
        print(f"  ✓ Run {run + 1}/{num_runs} completed: {total_time:.3f}s total ({total_batches} requests, "
              f"avg {total_time/total_batches:.3f}s per request)\n")

    avg_total_time = sum(times) / len(times)
    avg_time_per_request = avg_total_time / max(1, total_batches)

    return avg_time_per_request, avg_total_time


def run_benchmarks(card_ids: List[int], batch_sizes: List[int], num_runs: int = 3) -> Dict[int, Tuple[float, float]]:
    """Run benchmarks for all batch sizes."""
    results = {}
    benchmark_start_time = time.time()

    print(f"\n{'='*80}")
    print(f"BENCHMARK CONFIGURATION")
    print(f"{'='*80}")
    print(f"Total cards: {len(card_ids):,}")
    print(f"Batch sizes to test: {batch_sizes}")
    print(f"Runs per batch size: {num_runs}")
    print(f"Total tests: {len(batch_sizes)} batch sizes × {num_runs} runs = {len(batch_sizes) * num_runs} tests")
    print(f"{'='*80}\n")

    for idx, batch_size in enumerate(batch_sizes, 1):
        num_batches = (len(card_ids) + batch_size - 1) // batch_size
        print(f"[{idx}/{len(batch_sizes)}] Testing batch size: {batch_size} ({num_batches} requests per run)")
        print(f"{'-'*80}")

        test_start_time = time.time()
        avg_per_request, avg_total = benchmark_batch_size(card_ids, batch_size, num_runs)
        test_elapsed = time.time() - test_start_time

        results[batch_size] = (avg_per_request, avg_total)

        overall_elapsed = time.time() - benchmark_start_time
        estimated_remaining = (overall_elapsed / idx) * (len(batch_sizes) - idx)

        print(f"  📊 Results for batch size {batch_size}:")
        print(f"     • Average time per request: {avg_per_request:.3f}s")
        print(f"     • Average total time: {avg_total:.3f}s")
        print(f"     • Test duration: {test_elapsed:.1f}s")
        print(f"  ⏱️  Overall progress: {idx}/{len(batch_sizes)} tests completed")
        print(f"     • Total elapsed: {overall_elapsed:.1f}s")
        print(f"     • Estimated remaining: {estimated_remaining:.1f}s")
        print(f"{'-'*80}\n")

    total_elapsed = time.time() - benchmark_start_time
    print(f"{'='*80}")
    print(f"✓ All benchmarks completed in {total_elapsed:.1f}s ({total_elapsed/60:.1f} minutes)")
    print(f"{'='*80}\n")

    return results


def plot_results(results: Dict[int, Tuple[float, float]], total_cards: int):
    """Plot the benchmark results."""
    batch_sizes = sorted(results.keys())
    avg_per_request = [results[bs][0] for bs in batch_sizes]
    avg_total_time = [results[bs][1] for bs in batch_sizes]
    num_requests = [(total_cards + bs - 1) // bs for bs in batch_sizes]

    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 10))

    # Plot 1: Total time vs batch size
    ax1.plot(batch_sizes, avg_total_time, marker='o', linewidth=2, markersize=8)
    ax1.set_xlabel('Batch Size', fontsize=12)
    ax1.set_ylabel('Total Time (seconds)', fontsize=12)
    ax1.set_title(f'Total Time to Retrieve {total_cards} Cards', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.set_xscale('log')

    # Annotate the best performer
    best_batch_size = min(results.keys(), key=lambda bs: results[bs][1])
    best_time = results[best_batch_size][1]
    ax1.annotate(f'Best: {best_batch_size}\n{best_time:.2f}s',
                xy=(best_batch_size, best_time),
                xytext=(10, 20), textcoords='offset points',
                bbox=dict(boxstyle='round,pad=0.5', fc='yellow', alpha=0.7),
                arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0'))

    # Plot 2: Average time per request vs batch size
    ax2.plot(batch_sizes, avg_per_request, marker='s', linewidth=2, markersize=8, color='orange')
    ax2.set_xlabel('Batch Size', fontsize=12)
    ax2.set_ylabel('Average Time per Request (seconds)', fontsize=12)
    ax2.set_title('Average Time per Request', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.set_xscale('log')

    # Plot 3: Number of requests vs batch size
    ax3.plot(batch_sizes, num_requests, marker='^', linewidth=2, markersize=8, color='green')
    ax3.set_xlabel('Batch Size', fontsize=12)
    ax3.set_ylabel('Number of Requests', fontsize=12)
    ax3.set_title('Number of Requests Required', fontsize=14, fontweight='bold')
    ax3.grid(True, alpha=0.3)
    ax3.set_xscale('log')
    ax3.set_yscale('log')

    plt.tight_layout()

    # Save the plot
    filename = 'anki_batch_benchmark_results.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"\nPlot saved to: {filename}")

    plt.show()


def print_summary(results: Dict[int, Tuple[float, float]], total_cards: int):
    """Print a summary of the results."""
    print("\n" + "=" * 80)
    print("BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Total cards tested: {total_cards}")
    print(f"\n{'Batch Size':<12} {'Total Time':<15} {'Avg/Request':<15} {'# Requests':<12} {'Speedup':<10}")
    print("-" * 80)

    # Use batch size 1 as baseline
    baseline_time = results[min(results.keys())][1] if results else 1.0

    for batch_size in sorted(results.keys()):
        avg_per_request, avg_total = results[batch_size]
        num_requests = (total_cards + batch_size - 1) // batch_size
        speedup = baseline_time / avg_total

        print(f"{batch_size:<12} {avg_total:<15.3f} {avg_per_request:<15.3f} {num_requests:<12} {speedup:<10.2f}x")

    # Find the best batch size
    best_batch_size = min(results.keys(), key=lambda bs: results[bs][1])
    best_time = results[best_batch_size][1]

    print("\n" + "=" * 80)
    print(f"RECOMMENDATION: Use batch size {best_batch_size} ({best_time:.3f}s total)")
    print("=" * 80 + "\n")


def main():
    """Main execution function."""
    # Configuration
    QUERY = '"deck:Japan::1. Vocabulary"'  # Change this to your desired query (e.g., "deck:MyDeck" or "-is:suspended")
    BATCH_SIZES = [500, 750, 1000, 1250, 1500, 2000]
    NUM_RUNS = 5  # Number of times to run each batch size for averaging

    try:
        # Get all card IDs
        card_ids = get_all_card_ids(QUERY)

        if not card_ids:
            print("No cards found. Please adjust the query.")
            return

        # Limit batch sizes to reasonable values based on total cards
        max_batch_size = len(card_ids)
        batch_sizes = [bs for bs in BATCH_SIZES if bs <= max_batch_size]

        # Run benchmarks
        results = run_benchmarks(card_ids, batch_sizes, NUM_RUNS)

        # Print summary
        print_summary(results, len(card_ids))

        # Plot results
        plot_results(results, len(card_ids))

    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to AnkiConnect.")
        print("Please ensure:")
        print("  1. Anki is running")
        print("  2. AnkiConnect add-on is installed")
        print("  3. AnkiConnect is accessible at http://127.0.0.1:8765/")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
