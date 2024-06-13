function merge(nums1, m, nums2, n) {
  for (let a = 0, b = 0; a < nums1.length; a++) {
    if (nums1[a] > nums2[b]) {
      const num = nums1[a];
      nums1[a] = nums2[b];
      nums2[b] = num;
      b++;
    }
  }
  console.log(nums1);
}

merge([1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3);
