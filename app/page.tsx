'use client';

import { useEffect, useState } from 'react';
import { DATA } from '@/data/data';

type Item = {
  name: string;
  price: number;
};

type Snapshot = {
  id: number;
  totalQuantity: number;
  totalPrice: number;
  quantities: number[];
  createdAt: string;
};

export default function Home() {
  const isValidItems = (value: unknown): value is Item[] =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Item).name === 'string' &&
        typeof (item as Item).price === 'number'
    );

  const [items, setItems] = useState<Item[]>(() => DATA);

  const [quantities, setQuantities] = useState<number[]>(() =>
    DATA.map(() => 0)
  );

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(
    null
  );

  const [cumulativeQuantities, setCumulativeQuantities] = useState<number[]>(
    () => DATA.map(() => 0)
  );

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const [isSettingMode, setIsSettingMode] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('todaySalesSummary');
      if (!raw) return;
      const parsed: {
        quantities?: number[];
        updatedAt?: string;
        snapshots?: Snapshot[];
        items?: Item[];
      } = JSON.parse(raw);

      const savedItems = isValidItems(parsed.items) ? parsed.items : DATA;
      const targetLength = savedItems.length;

      const savedCumulative =
        parsed.quantities &&
        Array.isArray(parsed.quantities) &&
        parsed.quantities.length === targetLength
          ? parsed.quantities
          : savedItems.map(() => 0);

      const restoredSnapshots: Snapshot[] =
        parsed.snapshots && Array.isArray(parsed.snapshots)
          ? parsed.snapshots.map((snap) => ({
              ...snap,
              quantities: savedItems.map((_, idx) => snap.quantities[idx] ?? 0),
            }))
          : [];

      // 하위 호환: 스냅샷이 없고 누적만 있는 경우 요약 카드 1개 생성
      if (
        restoredSnapshots.length === 0 &&
        savedCumulative.some((q) => q > 0)
      ) {
        const restoredTotalQuantity = savedCumulative.reduce(
          (sum, q) => sum + q,
          0
        );
        const restoredTotalPrice = savedCumulative.reduce(
          (sum, q, index) => sum + q * (savedItems[index]?.price ?? 0),
          0
        );
        restoredSnapshots.push({
          id: parsed.updatedAt
            ? Date.parse(parsed.updatedAt) || Date.now()
            : Date.now(),
          totalQuantity: restoredTotalQuantity,
          totalPrice: restoredTotalPrice,
          quantities: savedItems.map((_, idx) => savedCumulative[idx] ?? 0),
          createdAt: parsed.updatedAt
            ? new Date(parsed.updatedAt).toLocaleTimeString()
            : '',
        });
      }

      setItems(savedItems);
      setCumulativeQuantities(savedCumulative);
      setSnapshots(restoredSnapshots);
      setQuantities(savedItems.map(() => 0));
    } catch {
      // ignore malformed storage
    }
  }, []);

  const handleQuantityChange = (index: number, nextValue: number) => {
    const value = Math.max(
      0,
      Math.floor(Number.isNaN(nextValue) ? 0 : nextValue)
    );
    setQuantities((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const persistState = (
    itemsList: Item[],
    cumulativeList: number[],
    snapshotsList: Snapshot[],
    timestamp = new Date()
  ) => {
    if (typeof window === 'undefined') return;

    const cumulativeTotalQuantity = cumulativeList.reduce(
      (sum, q) => sum + q,
      0
    );
    const cumulativeTotalPrice = cumulativeList.reduce(
      (sum, q, index) => sum + q * (itemsList[index]?.price ?? 0),
      0
    );

    const payload = {
      totalQuantity: cumulativeTotalQuantity,
      totalPrice: cumulativeTotalPrice,
      quantities: cumulativeList,
      updatedAt: timestamp.toISOString(),
      snapshots: snapshotsList,
      items: itemsList,
    };

    window.localStorage.setItem('todaySalesSummary', JSON.stringify(payload));
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    const parsedPrice = Math.floor(Number(newItemPrice));
    const price = Number.isNaN(parsedPrice) ? 0 : parsedPrice;

    if (!name || price <= 0) {
      setAddError('상품명과 0원 초과 가격을 입력해주세요.');
      return;
    }

    if (items.some((item) => item.name === name)) {
      setAddError('이미 동일한 상품명이 있습니다.');
      return;
    }

    const nextItems = [...items, { name, price }];
    const nextQuantities = [...quantities, 0];
    const nextCumulative = [...cumulativeQuantities, 0];
    const nextSnapshots = snapshots.map((snap) => ({
      ...snap,
      quantities: [...snap.quantities, 0],
    }));

    setItems(nextItems);
    setQuantities(nextQuantities);
    setCumulativeQuantities(nextCumulative);
    setSnapshots(nextSnapshots);
    setNewItemName('');
    setNewItemPrice('');
    setAddError('');

    persistState(nextItems, nextCumulative, nextSnapshots);
  };

  const recalcSnapshots = (itemsList: Item[], snapshotsList: Snapshot[]) =>
    snapshotsList.map((snap) => {
      const totalQuantity = snap.quantities.reduce((sum, q) => sum + q, 0);
      const totalPrice = snap.quantities.reduce(
        (sum, q, i) => sum + q * (itemsList[i]?.price ?? 0),
        0
      );
      return { ...snap, totalQuantity, totalPrice };
    });

  const handleDeleteItem = (index: number) => {
    if (!items[index]) return;

    const nextItems = items.filter((_, i) => i !== index);
    const nextQuantities = quantities.filter((_, i) => i !== index);
    const nextCumulative = cumulativeQuantities.filter((_, i) => i !== index);
    const nextSnapshots = recalcSnapshots(
      nextItems,
      snapshots.map((snap) => ({
        ...snap,
        quantities: snap.quantities.filter((_, i) => i !== index),
      }))
    );

    setItems(nextItems);
    setQuantities(nextQuantities);
    setCumulativeQuantities(nextCumulative);
    setSnapshots(nextSnapshots);
    setEditingSnapshotId(null);
    setAddError('');

    persistState(nextItems, nextCumulative, nextSnapshots);
  };

  const handleChangeItemName = (index: number, nextName: string) => {
    const name = nextName.trim();
    if (!name) return;
    const nextItems = items.map((item, i) =>
      i === index ? { ...item, name } : item
    );
    const nextSnapshots = recalcSnapshots(nextItems, snapshots);
    setItems(nextItems);
    setSnapshots(nextSnapshots);
    persistState(nextItems, cumulativeQuantities, nextSnapshots);
  };

  const handleChangeItemPrice = (index: number, nextPrice: string) => {
    const parsed = Math.floor(Number(nextPrice));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    const nextItems = items.map((item, i) =>
      i === index ? { ...item, price: parsed } : item
    );
    const nextSnapshots = recalcSnapshots(nextItems, snapshots);
    setItems(nextItems);
    setSnapshots(nextSnapshots);
    persistState(nextItems, cumulativeQuantities, nextSnapshots);
  };

  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  const totalPrice = quantities.reduce(
    (sum, q, index) => sum + q * (items[index]?.price ?? 0),
    0
  );

  const handleReset = () => {
    // 건별 스냅샷과 오늘 판매 요약(누적)만 초기화, 상품 목록은 유지
    const zeroed = items.map(() => 0);
    setQuantities(zeroed);
    setCumulativeQuantities(zeroed);
    setSnapshots([]);
    setEditingSnapshotId(null);
    setIsSettingMode(false);

    persistState(items, zeroed, [], new Date());
  };

  const handleConfirm = () => {
    if (totalQuantity === 0) return;

    const now = new Date();
    const nextCumulative = cumulativeQuantities.map(
      (prev, index) => prev + (quantities[index] ?? 0)
    );

    // 건별 스냅샷은 해당 시점의 입력값만 저장 (누적 아님)
    const snapshot: Snapshot = {
      id: now.getTime(),
      totalQuantity: totalQuantity, // 현재 입력값의 총 개수
      totalPrice: totalPrice, // 현재 입력값의 총 가격
      quantities: [...quantities], // 현재 입력값 복사
      createdAt: now.toLocaleTimeString(),
    };

    const nextSnapshots: Snapshot[] = [snapshot, ...snapshots];

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);

    // 로컬스토리지에 누적 금액 및 상품 수량, 건별 스냅샷 저장
    persistState(items, nextCumulative, nextSnapshots, now);

    // 확인 후 현재 입력값 초기화
    setQuantities(() => items.map(() => 0));
  };

  const handleDeleteSnapshot = (id: number) => {
    const target = snapshots.find((snap) => snap.id === id);
    if (!target) return;

    const nextSnapshots = snapshots.filter((snap) => snap.id !== id);

    const nextCumulative = cumulativeQuantities.map(
      (value, index) => value - (target.quantities[index] ?? 0)
    );

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);

    if (editingSnapshotId === id) {
      setEditingSnapshotId(null);
      setQuantities(() => items.map(() => 0));
    }

    persistState(items, nextCumulative, nextSnapshots);
  };

  const handleFullSet = () => {
    setQuantities((prev) => prev.map((q) => q + 1));
  };
  const handleSelectSnapshot = (id: number) => {
    // 이미 선택된 항목을 다시 누르면 선택 해제
    if (editingSnapshotId === id) {
      setEditingSnapshotId(null);
      setQuantities(() => items.map(() => 0));
      return;
    }

    const target = snapshots.find((snap) => snap.id === id);
    if (!target) return;

    setQuantities([...target.quantities]);
    setEditingSnapshotId(id);
  };

  const handleUpdateSnapshot = () => {
    if (editingSnapshotId === null) return;

    const targetIndex = snapshots.findIndex(
      (snap) => snap.id === editingSnapshotId
    );
    if (targetIndex === -1) return;

    const oldSnapshot = snapshots[targetIndex];

    const nextQuantities = [...quantities];
    const nextTotalQuantity = nextQuantities.reduce((sum, q) => sum + q, 0);
    const nextTotalPrice = nextQuantities.reduce(
      (sum, q, index) => sum + q * (items[index]?.price ?? 0),
      0
    );

    // 누적값은 (새 수량 - 기존 수량) 만큼 반영
    const nextCumulative = cumulativeQuantities.map((value, index) => {
      const diff =
        (nextQuantities[index] ?? 0) - (oldSnapshot.quantities[index] ?? 0);
      return value + diff;
    });

    const updatedSnapshot: Snapshot = {
      ...oldSnapshot,
      totalQuantity: nextTotalQuantity,
      totalPrice: nextTotalPrice,
      quantities: nextQuantities,
      createdAt: new Date().toLocaleTimeString(),
    };

    const nextSnapshots = snapshots.map((snap) =>
      snap.id === editingSnapshotId ? updatedSnapshot : snap
    );

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);
    setEditingSnapshotId(null);
    setQuantities(() => items.map(() => 0));

    persistState(items, nextCumulative, nextSnapshots);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-1 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">굿즈 수량 입력</h1>
        <button
          type="button"
          onClick={() =>
            setIsSettingMode((prev) => {
              const next = !prev;
              if (next) {
                setEditingSnapshotId(null);
                setQuantities(items.map(() => 0));
              }
              return next;
            })
          }
          className={`px-4 py-2 rounded border text-sm md:text-base ${
            isSettingMode ? 'bg-blue-50 border-blue-400 text-blue-700' : ''
          }`}
        >
          세팅 모드 {isSettingMode ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setIsResetModalOpen(true)}
          className="px-4 py-2 rounded border text-sm md:text-base"
        >
          초기화
        </button>
      </div>

      {isSettingMode ? (
        <div className="bg-white shadow-md p-4 rounded-md border space-y-2">
          <h2 className="text-sm font-semibold">상품 추가</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              type="text"
              className="md:col-span-3 border rounded px-3 py-2 text-sm md:text-base"
              placeholder="예) 신규 굿즈 이름"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <input
              type="number"
              min={1}
              className="md:col-span-2 border rounded px-3 py-2 text-sm md:text-base"
              placeholder="가격 (원)"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="md:col-span-1 w-full px-3 py-2 rounded bg-green-600 text-white text-sm md:text-base disabled:opacity-40"
            >
              상품 추가
            </button>
          </div>
          {addError ? (
            <p className="text-sm text-red-600">{addError}</p>
          ) : (
            <p className="text-xs text-gray-500">
              상품명과 가격을 입력하면 목록 하단에 추가됩니다.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-6 items-stretch">
        {/* 왼쪽: 굿즈 수량 입력 */}
        <div className="col-span-2 space-y-4 h-[600px] bg-white shadow-md p-4 rounded-md border">
          {isSettingMode ? (
            <>
              <div className="grid grid-cols-3 font-semibold border-b pb-2 text-sm md:text-base">
                <div>상품명</div>
                <div className="text-right">가격</div>
                <div className="text-center">관리</div>
              </div>
              {items.length === 0 ? (
                <div className="py-6 text-center">
                  <span className="text-sm text-gray-500">
                    상품을 추가해주세요.
                  </span>
                </div>
              ) : (
                items.map((item, index) => (
                  <div
                    key={item.name + index}
                    className="grid grid-cols-3 items-center py-2 border-b last:border-b-0 text-sm md:text-base gap-2"
                  >
                    <input
                      type="text"
                      className="border rounded px-2 py-1"
                      value={item.name}
                      onChange={(e) =>
                        handleChangeItemName(index, e.target.value)
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-2 py-1 text-right"
                      value={item.price}
                      onChange={(e) =>
                        handleChangeItemPrice(index, e.target.value)
                      }
                    />
                    <div className="flex justify-center">
                      <button
                        type="button"
                        className="px-2 py-1 border rounded text-[11px] text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteItem(index)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 font-semibold border-b pb-2 text-sm md:text-base">
                <div>상품명</div>
                <div className="text-right">가격</div>
                <div className="text-center">수량</div>
                <div className="text-right">금액</div>
              </div>

              {items.length === 0 ? (
                <div className="py-6 text-center">
                  <span className="text-sm text-gray-500">
                    상품을 추가해주세요.
                  </span>
                </div>
              ) : (
                items.map((item, index) => {
                  const quantity = quantities[index] ?? 0;
                  const lineTotal = quantity * item.price;

                  return (
                    <div
                      key={item.name}
                      className="grid grid-cols-4 items-center py-2 border-b last:border-b-0 text-sm md:text-base gap-2"
                    >
                      <div
                        className={
                          quantity > 0
                            ? 'bg-red-500 text-white rounded px-2 py-0.5'
                            : ''
                        }
                      >
                        {item.name}
                      </div>
                      <div className="text-right">
                        {item.price.toLocaleString()}원
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 border rounded text-sm"
                          onClick={() =>
                            handleQuantityChange(index, quantity - 1)
                          }
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
                          onClick={() =>
                            handleQuantityChange(index, quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        {lineTotal.toLocaleString()}원
                      </div>
                    </div>
                  );
                })
              )}

              <div className="grid grid-cols-4 items-center font-semibold pt-4 border-t mt-4 text-sm md:text-base gap-2">
                <div className="col-span-2 text-right">현재 합계</div>
                <div className="text-center">
                  총 {totalQuantity.toLocaleString()}개
                </div>
                <div className="text-right">
                  {totalPrice.toLocaleString()}원
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleFullSet}
                  className="mt-2 px-3 py-2 rounded border text-xs md:text-sm"
                >
                  풀세트
                </button>
                <button
                  type="button"
                  onClick={
                    editingSnapshotId === null
                      ? handleConfirm
                      : handleUpdateSnapshot
                  }
                  className="mt-2 px-4 py-2 rounded bg-blue-600 text-white text-sm md:text-base disabled:opacity-40"
                  disabled={totalQuantity === 0}
                >
                  {editingSnapshotId === null ? '입력' : '수정하기'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 건별 스냅샷 */}
        <div className="col-span-1 flex flex-col h-[600px] bg-white shadow-md p-4 rounded-md border">
          {snapshots.length > 0 ? (
            <>
              <h2 className="text-sm font-semibold border-b pb-2 mb-4">
                건별 스냅샷
              </h2>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {snapshots.map((snap, index) => (
                  <div
                    key={snap.id}
                    className={`border rounded-md p-3 bg-white space-y-1 text-xs md:text-sm cursor-pointer ${
                      editingSnapshotId === snap.id
                        ? 'border-blue-500 ring-1 ring-blue-300'
                        : ''
                    }`}
                    onClick={() => handleSelectSnapshot(snap.id)}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="truncate">
                        {snapshots.length - index}회 · {snap.createdAt}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>{snap.totalPrice.toLocaleString()}원</span>
                        <button
                          type="button"
                          className="px-2 py-0.5 border rounded text-[11px] text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSnapshot(snap.id);
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {snap.quantities.map((q, i) => {
                        const item = items[i];
                        if (!item || q <= 0) return null;
                        return (
                          <span
                            key={`${snap.id}-item-${item.name}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 border"
                          >
                            {item.name} × {q}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-400 text-sm text-center">
                건별 스냅샷이 없습니다
              </div>
            </div>
          )}
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <p className="text-sm md:text-base">
              정말로 초기화 하시겠습니까?
              <br />
              (누적된 금액과 수량이 모두 삭제됩니다)
            </p>
            <div className="flex justify-end gap-2 text-sm md:text-base">
              <button
                type="button"
                className="px-4 py-2 rounded border"
                onClick={() => setIsResetModalOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-600 text-white"
                onClick={() => {
                  handleReset();
                  setIsResetModalOpen(false);
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {(cumulativeQuantities.some((q) => q > 0) || snapshots.length > 0) && (
        <div className="mt-6 border-t pt-4 space-y-3">
          <h2 className="text-lg font-semibold">오늘 판매 요약</h2>
          <div className="space-y-3 text-sm md:text-base">
            {(() => {
              const cumulativeTotalQuantity = cumulativeQuantities.reduce(
                (sum, q) => sum + q,
                0
              );
              const cumulativeTotalPrice = cumulativeQuantities.reduce(
                (sum, q, index) => sum + q * (items[index]?.price ?? 0),
                0
              );

              if (cumulativeTotalQuantity === 0) return null;

              return (
                <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between font-semibold">
                    <span>누적</span>
                    <span>{cumulativeTotalPrice.toLocaleString()}원</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {cumulativeQuantities.map((q, i) =>
                      q > 0 && items[i] ? (
                        <span
                          key={`cumulative-${items[i].name}`}
                          className="inline-flex items-center px-2 py-1 rounded-full bg-white border text-xs md:text-sm"
                        >
                          {items[i].name} × {q}
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
