import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { PlaceImage } from '@/features/home/components/PlaceImage';
import { palette, radius, spacing } from '@/design/tokens';

interface ImageCarouselProps {
  images: string[] | null | undefined;
  category: string;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Paged hero. With zero or one image it collapses to a single frame and hides
 * the dots, so a place with no photo still gets a deliberate coloured hero
 * rather than an empty grey box.
 */
export function ImageCarousel({ images, category, height = 320 }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const slides = images && images.length > 0 ? images : [null];

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={slides.length > 1}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((uri, slideIndex) => (
          <PlaceImage
            key={uri ?? `placeholder-${slideIndex}`}
            uri={uri}
            category={category}
            height={height}
            borderRadius={0}
            scrim
            style={{ width: SCREEN_WIDTH }}
          />
        ))}
      </ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((_, dotIndex) => (
            <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.canvasSunken },
  dots: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.onInkFaint,
  },
  dotActive: { backgroundColor: palette.inkInverse, width: 18 },
});
