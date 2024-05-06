<?php
/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

namespace MediaWiki\Extension\DiscourseIntegration;

class DiscourseIntegration {

	// DiscourseIntegration singleton instance
	private static $instance = null;

	/**
	 * create a DiscourseIntegration singleton instance
	 *
	 * @return DiscourseIntegration a singleton DiscourseIntegration instance
	 */
	public static function singleton() : self {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * initializes the display of comments
	 *
	 * @param OutputPage $output OutputPage object
	 */
	public function init( $output ) {
		if ( $this->checkDisplayComments( $output ) )
		{
			$this->initJS( $output );
		}
	}

	/**
	 * checks to see if comments should be displayed on this page
	 *
	 * @param OutputPage $output the OutputPage object
	 * @return bool true if comments should be displayed on this page
	 */
	private function checkDisplayComments( $output ) {

		// don't display comments on any page action other than view action
		if ( \Action::getActionName( $output->getContext() ) !== "view" ) {
			return false;
		}

		$title = $output->getTitle();

		// don't display comments on the main page
		if ( $title->isMainPage() ) {
			return false;
		}

		// don't display comments on pages that do not exist
		if ( !$title->exists() ) {
			return false;
		}

		// don't display comments on redirect pages
		if ( $title->isRedirect() ) {
			return false;
		}

		return true;
	}

	/**
	 * initialize JavaScript
	 *
	 * @param OutputPage $output the OutputPage object
	 */
	private function initJS( $output ) {
		$params = [];

		$params['DiscourseURL'] = $GLOBALS['wgDiscourseURL'];

		$output->addJsConfigVars( 'DiscourseIntegration', $params );
		$output->addModules( ['ext.DiscourseIntegration'] );
	}
}
