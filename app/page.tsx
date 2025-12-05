'use client';

import { useState } from 'react';
import { DATA } from '@/data/data';

export default function Home() {
  const [quantities, setQuantities] = useState<number[]>(() =>
    DATA.map(() => 0)
  );

  type Snapshot = {
    id: number;
    totalQuantity: number;
    totalPrice: number;
    quantities: number[];
    createdAt: string;
  };

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [cumulativeQuantities, setCumulativeQuantities] = useState<number[]>(
    () => DATA.map(() => 0)
  );

  const handleQuantityChange = (index: number, nextValue: number) => {
    const value = Math.max(
      0,
      Math.floor(Number.isNaN(nextValue) ? 0 : nextValue)
    );
    setQuantities((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  const totalPrice = quantities.reduce(
    (sum, q, index) => sum + q * DATA[index].price,
    0
  );

  const handleConfirm = () => {
    if (totalQuantity === 0) return;

    const now = new Date();
    const nextCumulative = cumulativeQuantities.map(
      (prev, index) => prev + (quantities[index] ?? 0)
    );

    const cumulativeTotalQuantity = nextCumulative.reduce(
      (sum, q) => sum + q,
      0
    );
    const cumulativeTotalPrice = nextCumulative.reduce(
      (sum, q, index) => sum + q * DATA[index].price,
      0
    );

    const snapshot: Snapshot = {
      id: now.getTime(),
      totalQuantity: cumulativeTotalQuantity,
      totalPrice: cumulativeTotalPrice,
      quantities: nextCumulative,
      createdAt: now.toLocaleTimeString(),
    };

    setSnapshots((prev) => [snapshot, ...prev]);
    setCumulativeQuantities(nextCumulative);

    // 확인 후 현재 입력값 초기화
    setQuantities(() => DATA.map(() => 0));
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-2">굿즈 수량 입력</h1>

      <div className="grid grid-cols-4 font-semibold border-b pb-2 text-sm md:text-base">
        <div>상품명</div>
        <div className="text-right">가격</div>
        <div className="text-center">수량</div>
        <div className="text-right">금액</div>
      </div>

      {DATA.map((item, index) => {
        const quantity = quantities[index] ?? 0;
        const lineTotal = quantity * item.price;

        return (
          <div
            key={item.name}
            className="grid grid-cols-4 items-center py-2 border-b last:border-b-0 text-sm md:text-base gap-2"
          >
            <div>{item.name}</div>
            <div className="text-right">{item.price.toLocaleString()}원</div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className="px-2 py-1 border rounded text-sm"
                onClick={() => handleQuantityChange(index, quantity - 1)}
              >
                -
              </button>
              <input
                type="number"
                min={0}
                className="w-16 border rounded px-2 py-1 text-center"
                value={quantity}
                onChange={(e) =>
                  handleQuantityChange(index, Number(e.target.value))
                }
              />
              <button
                type="button"
                className="px-2 py-1 border rounded text-sm"
                onClick={() => handleQuantityChange(index, quantity + 1)}
              >
                +
              </button>
            </div>
            <div className="text-right">{lineTotal.toLocaleString()}원</div>
          </div>
        );
      })}

      <div className="grid grid-cols-4 items-center font-semibold pt-4 border-t mt-4 text-sm md:text-base gap-2">
        <div className="col-span-2 text-right">현재 합계</div>
        <div className="text-center">총 {totalQuantity.toLocaleString()}개</div>
        <div className="text-right">{totalPrice.toLocaleString()}원</div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          className="mt-2 px-4 py-2 rounded bg-blue-600 text-white text-sm md:text-base disabled:opacity-40"
          disabled={totalQuantity === 0}
        >
          확인
        </button>
      </div>

      {snapshots.length > 0 && (
        <div className="mt-6 border-t pt-4 space-y-3">
          <h2 className="text-lg font-semibold">오늘 판매 요약</h2>
          <div className="space-y-3 text-sm md:text-base">
            {(() => {
              const latest = snapshots[0];
              return (
                <div
                  key={latest.id}
                  className="border rounded-md p-3 space-y-2 bg-gray-50"
                >
                  <div className="flex justify-between font-semibold">
                    <span>누적</span>
                    <span>{latest.totalPrice.toLocaleString()}원</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {latest.quantities.map((q, i) =>
                      q > 0 ? (
                        <span
                          key={`${latest.id}-${DATA[i].name}`}
                          className="inline-flex items-center px-2 py-1 rounded-full bg-white border text-xs md:text-sm"
                        >
                          {DATA[i].name} × {q}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
