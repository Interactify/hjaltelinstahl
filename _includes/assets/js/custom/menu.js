$('.sprog').click(function() {
		$('.customdansk').toggle();
		$('.customenglish').toggle();
		$('.dansk').toggle();
		$('.english').toggle();
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
    
    
$(function(){
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
})
	
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


