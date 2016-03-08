jQuery(document).ready(function($) {
	var pageheight = $(window).height();
		$('#video-gallery').css('height', pageheight - 282);
		$(window).resize(function(){
		var pageheight = $(window).height();
		$('#video-gallery').css('height', pageheight - 282);
	});	
});

jQuery(document).ready(function($) {
  $('#video-gallery').royalSlider({
	arrowsNav: true,
	arrowsNavAutoHide: true,
	arrowsNavHideOnTouch: true,
	fadeinLoadedSlide: true,
	controlNavigation: 'none',
	keyboardNavEnabled: true,
	imageScaleMode: 'fill',
	imageAlignCenter:true,
	slidesSpacing: 0,
	loopRewind: true,
	navigateByClick: false,
	numImagesToPreload: 2,
	autoScaleSlider: false,
	autoPlay: {
		enabled: true,
		pauseOnHover: false,
		delay: 5000
	}
  });  
});