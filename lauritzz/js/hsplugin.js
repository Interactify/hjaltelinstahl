/* Åbner Casen for lotto */
jQuery('a.Lotto').click(function(){
		$(".grid img.Lotto").trigger("click");
	});


$('.sprog').click(function() {
		$('.customdansk').toggle();
		$('.customenglish').toggle();
		$('.dansk').toggle();
		$('.english').toggle();
	});
jQuery('#test').click(function(){
	var hey = $(this).attr("class");
	$(".grid img."+hey).trigger("click");
});
jQuery(document).ready(function(){
	$('.insideheight h6 + p').css({"max-height" : "66px", "overflow" : "hidden", "cursor" : "pointer" });
	$('.insideheight', this).click(function() {
		if ($(this).find('h6 + p').css('max-height') === '1000px') 
		{
			$(this).find('h6 + p').animate({ "max-height" : "66px"});
			$(this).find('span').text('Læs mere');
		}else{
			$('.insideheight h6 + p').css({"max-height" : "66px", "overflow" : "hidden", "cursor" : "pointer" });
				$(this).find('h6 + p').animate({ "max-height" : "1000px"});
				$('.readmore').text('Læs mere');
				$(this).find('span').text('Luk igen');
		}	
	});
});
jQuery(document).ready(function($) {
	var pageheight = $(window).height();
		$('#video-gallery').css('height', pageheight - 282);
		$(window).resize(function(){
		var pageheight = $(window).height();
		$('#video-gallery').css('height', pageheight - 282);
	});	
});	
if (Modernizr.touch){
	var timeripad = 0
	var timeriphone = 0
	} else {
	var timeripad = 700
	var timeriphone = 700
	}
jQuery('#responsive-menu-button').sidr({
	name: 'sidr-main',
	side: 'right',
	source: '#navigationmobile'
});
stoptiden = jQuery(".sidr-inner a").click(function () {
	 stoptiden.delay(10)
     .queue(function( nxt ) {
         $.sidr('close', 'sidr-main');
         nxt();
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

jQuery('.grid img').click(function(){
	jQuery(".jqheader").text($(this).data('header'));
	jQuery(".jqarea").text($(this).data('area'));
	jQuery(".jqtext").text($(this).data("text"));
	var myClass = $(this).attr("class");
	var scrollelement = $(this).closest('.container').next('.dropdownslider');
	var dropdown = $(this).closest('.container').next('.dropdownslider');
	var $viewport = $('html, body');
	
	var sliderindhold = messages[myClass];
	
	jQuery('.close').click(function(){
		$('.dropdownslider').slideUp(300);
		jQuery('.slider').royalSlider('destroy').empty();
		});
	if($(dropdown).is(':hidden')) {
		$('.dropdownslider').removeClass('active')
		if(!$(dropdown).hasClass('active')) {				
	 		$('.dropdownslider').slideUp(300)
				}
			$(dropdown).slideDown(300),
			$(dropdown).addClass('active')
			$(dropdown).queue( function () {
			 $viewport.animate({
				 scrollTop: 
				 $(scrollelement).offset().top -82
			 }, timeripad);
		 $viewport.bind("scroll mousedown DOMMouseScroll mousewheel keyup", function(e){
		if ( e.which > 0 || e.type === "mousedown" || e.type === "mousewheel"){
			 $viewport.stop().unbind('scroll mousedown DOMMouseScroll mousewheel keyup'); 
		}
		});    
		 $( this ).dequeue(); 
		});
	}else{
		$('.dropdownslider').removeClass('active')
			$(dropdown).slideDown(300),
			$(dropdown).addClass('active')
			$(dropdown).queue( function () {
			 $viewport.animate({
				 scrollTop: 
				 $(scrollelement).offset().top -82
			 }, timeripad);
		 $viewport.bind("scroll mousedown DOMMouseScroll mousewheel keyup", function(e){
		if ( e.which > 0 || e.type === "mousedown" || e.type === "mousewheel"){
			 $viewport.stop().unbind('scroll mousedown DOMMouseScroll mousewheel keyup'); 
		}
		});    
		 $( this ).dequeue(); 
		});
	}
		var slider = $('.active .slider').royalSlider('destroy').empty().royalSlider({
        slides: sliderindhold,
				slidesSpacing: 0,
				centerArea: 0.5,
				center: true,
				breakpoint: 800,
				controlNavigation: 'bullets',
				autoScaleSlider: true, 
				autoScaleSliderWidth: 1200,     
				autoScaleSliderHeight: 400,
				autoHeight: true,
				loopRewind: true,
				navigateByClick: true,
				imageAlignCenter:true,
				numImagesToPreload:3,
				arrowsNav:true,
				arrowsNavAutoHide: true,
				arrowsNavHideOnTouch: true,
				keyboardNavEnabled: true,
				fadeinLoadedSlide: true,
				globalCaption: true,
				allowCSS3:false,
				globalCaptionInside: false
		    }).data('royalSlider');
			slider.ev.on('rsBeforeDestroy', function() {
			    $('.dropdownslider.active .jqtext').show( 300 );
			});
			slider.ev.on('rsAfterSlideChange', function(event, type, userAction ) {
				if ($('.active .rsContainer').css('left') == '0px'){
				   $('.dropdownslider.active .jqtext').show( 300 );
				}else{
					$('.dropdownslider.active .jqtext').hide( 300 );
				};
			});
	});
function getTargetTop(elem){
		var id = elem.attr("href");
		var offset = 82;
		return $(id).offset().top - offset;
	}
	$('a[href^="#"]').click(function(event) {
		var target = getTargetTop($(this));
		$('html, body').animate({scrollTop:target}, timeriphone);
		event.preventDefault(event);
	});
	var sections = $('a.den[href^="#"]');
	function checkSectionSelected(scrolledTo){
		var threshold = 500;
		var i;
		for (i = 0; i < sections.length; i++) {
			var section = $(sections[i]);
			var target = getTargetTop(section);

			if (scrolledTo > target - threshold && scrolledTo > target - 82) {
				sections.parent().removeClass("navactive");
				section.parent().addClass("navactive");
			}
		};
	}
	checkSectionSelected($(window).scrollTop());
	$(window).scroll(function(e){
		checkSectionSelected($(window).scrollTop())
	});
(function($){
  // get hash value
		$(window).on('hashchange', function() {
		 var hash = window.location.hash;
		  // now scroll to element with that id
		  $('html, body').animate({ scrollTop: $(hash).offset().top -82 });
		});
})(jQuery);

jQuery(document).ready(function($) {
var hash = window.location.hash;
var newhash = hash.substr(1,99);
	if (newhash.length) {
	if ( $(".grid img").hasClass(newhash) ){
		$(".grid img."+newhash).trigger("click");
	}else{
		$("a[href='"+hash+"']").trigger("click");
	}
	}
});





var userFeed = new Instafeed({
        get: 'user',
        links: true,
        template: '<div id="nummer{{denklasse}}" class="nummer"><img src="{{image}}" /><div class="caption"><a href="{{link}}" target="_blank">{{caption}}</a></div></div>',
        userId: 547295039,
        accessToken: '547295039.467ede5.773f699b58ee49589804f9eaf9afd062',
        after: function () {
	      	var divs = $("#instafeed > div");
	      	for(var i = 0; i < divs.length; i+=5) {
	        divs.slice(i, i+5).wrapAll("<div class='test new"+i+"'></div>");
      }
      $(".test").on( "click", ".nummer", function(event) {
      if (!$(this).hasClass("aktiv")) {
      $('.nummer').removeClass('aktiv');
        var b0 = $(this).clone().addClass('aktiv');
        b0.prependTo($(this).parent());
        $(this).remove();
        $(this).unbind('click'); 
        }
      });

    
    }
     
    })
    userFeed.run();
    
    (function($){
      $(window).load(function(){
        $("#instacontainer").mCustomScrollbar({
          mouseWheel:false,
          scrollButtons:{
            enable:false,
            scrollSpeed: "auto"
          },
          autoHideScrollbar:true,
          horizontalScroll:true,
          advanced:{
            autoExpandHorizontalScroll:true
          }
        });
      });
    })(jQuery);

jQuery(document).ready(function($){

  
});

/* instagram
*/
      /*
      setTimeout(function() {
     var min = 0;
      var max = 20;
      var random = Math.floor(Math.random() * (max - min + 1)) + min;
      //var hey = '.nummer'+random+'';
      $('#nummer'+random+'').addClass('anim');

        setInterval( function() {
          var random = Math.floor(Math.random() * (max - min + 1)) + min;
          $('.nummer').removeClass('anim');
          $('#nummer'+random+'').addClass('anim');
          console.log(random);
        }, 2000);

      }, 1000);
      */
