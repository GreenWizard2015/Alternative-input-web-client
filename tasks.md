SampleManager shd call worker if count of minTime<...< maxTime above limit. They shd be splitted by chunks of limit.
flushAndClear send all chunks. store only full, rest saved for next call.
add test first