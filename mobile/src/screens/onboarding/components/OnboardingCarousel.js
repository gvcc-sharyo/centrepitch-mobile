import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ImageBackground, Text, View, useWindowDimensions } from "react-native";

const CardItem = memo(function CardItem({ item, index, isDark, cardWidth, cardGap, itemSize, scrollX }) {
  const inputRange = [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.94, 1, 0.94],
    extrapolate: "clamp",
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.85, 1, 0.85],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width: cardWidth, marginRight: cardGap }}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <View
          className={[
            "overflow-hidden rounded-[28px] border",
            isDark ? "border-white/10 bg-white/5" : "border-neutral-900/10 bg-black/[0.02]",
          ].join(" ")}
        >
          <ImageBackground
            source={item.image}
            resizeMode="cover"
            className="h-[420px] justify-end p-5"
          >
            <View className="absolute inset-0 bg-black/15" />
            <View className="absolute inset-x-0 bottom-0 h-28 bg-black/45" />
            <View className="gap-1.5">
              <Text className="text-3xl font-newsreader-bold text-white" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-sm leading-5 text-white/90">
                Explore {item.title.toLowerCase()} with Centre Pitch.
              </Text>
            </View>
          </ImageBackground>
        </View>
      </Animated.View>
    </View>
  );
});

export default function OnboardingCarousel({ isDark }) {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const scrollHandler = useRef(null);
  const CARD_GAP = 8;
  const EDGE_PEEK = 40; // how much space to leave at each edge (controls how much next/prev card is visible)
  const CARD_WIDTH = Math.min(width - EDGE_PEEK * 2, 360); // smaller card = more peeking
  const SIDE_INSET = (width - CARD_WIDTH) / 2;
  const ITEM_SIZE = CARD_WIDTH + CARD_GAP;

  const cards = useMemo(
    () => [
      // Using existing bento assets from `mobile/assets/public/`.
      // If you later add a dedicated analytics bento image, swap this file.
      { key: "analytics", title: "Analytics", image: require("../../../../assets/public/faq_top_card_bg.png") },
      { key: "events", title: "Events", image: require("../../../../assets/public/bento_events_bg.png") },
      { key: "academies", title: "Academies", image: require("../../../../assets/public/bento_academy_bg.png") },
      { key: "coaches", title: "Coaches", image: require("../../../../assets/public/coach_img.png") },
      { key: "courts", title: "Courts", image: require("../../../../assets/public/bento_courts_bg.png") },
    ],
    []
  );

  // Infinite loop: render 3 copies and keep user in the middle copy.
  const looped = useMemo(() => [...cards, ...cards, ...cards], [cards]);
  const middleIndex = cards.length; // first item of middle copy
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // Jump to the middle copy on mount/resize so "continuous" feels natural.
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: middleIndex * ITEM_SIZE, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [middleIndex, ITEM_SIZE, width]);

  const onMomentumScrollEnd = useCallback(
    (e) => {
      const x = e?.nativeEvent?.contentOffset?.x ?? 0;
      const rawIndex = Math.round(x / ITEM_SIZE);

      // Track active dot (0..cards.length-1) based on middle copy position.
      const normalized = ((rawIndex % cards.length) + cards.length) % cards.length;
      setActiveIndex(normalized);

      // If user scrolls into the first/last copy, jump back to the middle copy same normalized index.
      if (rawIndex < cards.length || rawIndex >= cards.length * 2) {
        const target = middleIndex + normalized;
        listRef.current?.scrollToOffset({ offset: target * ITEM_SIZE, animated: false });
      }
    },
    [ITEM_SIZE, cards.length, middleIndex]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <CardItem
        item={item}
        index={index}
        isDark={isDark}
        cardWidth={CARD_WIDTH}
        cardGap={CARD_GAP}
        itemSize={ITEM_SIZE}
        scrollX={scrollX}
      />
    ),
    [CARD_GAP, CARD_WIDTH, ITEM_SIZE, isDark, scrollX]
  );

  if (!scrollHandler.current) {
    // Keep a stable handler so VirtualizedList doesn't re-subscribe each render.
    scrollHandler.current = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true });
  }

  return (
    <View className="flex-1 pt-2.5">
      <Animated.FlatList
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={looped}
        keyExtractor={(item, idx) => `${item.key}-${idx}`}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
        snapToInterval={ITEM_SIZE}
        // With side insets, snapping to "start" keeps every card perfectly centered.
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={scrollHandler.current}
        scrollEventThrottle={16}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        getItemLayout={(_, index) => ({ length: ITEM_SIZE, offset: ITEM_SIZE * index, index })}
        renderItem={renderItem}
      />

      <View className="flex-row items-center justify-center gap-2 pt-3.5 pb-2">
        {cards.map((_, idx) => {
          const isActive = idx === activeIndex;
          const inputRange = [
            (idx - 1) * ITEM_SIZE,
            idx * ITEM_SIZE,
            (idx + 1) * ITEM_SIZE,
          ];
          // Dots are driven by activeIndex (more stable with looping),
          // but we keep a tiny scale pop for nicer motion.
          const opacity = isActive ? 1 : 0.35;
          const scale = isActive ? 1.15 : 0.9;
          return (
            <Animated.View
              key={idx}
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: isDark ? "#ffffff" : "#111827",
                opacity,
                transform: [{ scale }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

